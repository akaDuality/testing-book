# Domain Specific Language

Когда разработчики пишут первые тесты они обычно сильно стесняются написать немного дополнительного кода. Буквально пара лишних строчек создают ощущение, что это все нужно будет поддерживать, а абстракции в тестах больше мешают. 

Давайте пойдем от обратного: тест должен быть очень конкретный, очень понятный и скрывать лишние детали, потому что мы больше читаем код, а не пишем его. А если тест упал, то он должен давать достаточно информации про состояние тестируемых объектов. Таким подходом у нас накопится много полезных тестов с которыми будет приятно работать в будущем. 

Решить эту задачу помогает Domain Specific Language (DSL) – так называют весь код, который пишут специльно для тестов и который позволяет написать тесты красиво. Называется он так, потому что описывает операции вашей предметной области (т.е. домена), а вот вызывать внутри себя может довольно абстрактные функции. Проще запомнить как «DSL это просто код для красивых тестов», а остальное будет понятно на примерах.

## Overview

Каждый тест это минимум 10 строчек, если учитывать и пустые строки. Десяток тестов превращаются в сотни строк, который надо быстро читать, чтобы понять что уже протестировали, а что еще нет. Просто вызывать продакшен-код неудобно: тесты будут длинными и слишком детальными, в них сложно будет разобраться. 

Даже в простом задании на боулинг я уже использовал DSL. Вот тест, где код вызываем напрямую:

```swift
@Test func 'what is this test about'() {
    let game = Game()
    game.roll(4)
    game.roll(6)

    game.roll(6)

    #expect(game.score == 22)
}
```

В таком тесте не видно главного: первые два броска в сумме должны давать 10, чтобы удвоить следующий бросок. Можно написать комментарий про это, но удобней вынести в функцию, так тест станет намного понятней. Вот весь вспомогательный код для боулинга:

```swift
@Suite
class PlayerGameTest {
    let sut = PlayerGame()
    
    var score: Int { sut.score }
    
    func roll(_ pins: Int) { sut.roll(pint) }
    
    func strike() { sut.roll(10) }
    
    func spare(first: Int = 4) {
        roll(first)
        roll(10-first)
    }
}
```

Тесты с DSL легко читать и писать, но главное, что они выглядят буквально как правила игры:

```swift
@Test func 'when two rolls are 10 in sum should double next roll`() {
    spare(first: 4)

    roll(6)

    #expect(score == 10 + 6*2)
}
```

Все тесты начинают опираться на единый вспомогательный код, поэтому при изменении продакшен-кода можно будет обновить код только внутри DSL — тесты останутся теми же самыми, что сильно облегчает их поддержку.

## Единый уровень детализации

Главное правило понятного кода можно свети к такому: **внутри функции код должен иметь единый уровень детализации.** 

Это правило подходит и для тестов. DSL позволяет унести незначительные детали за пределы теста и выдержать единый уровень детализации. 

> Note: К тестам стоит применять все те же правила, что вы применяете к обычному коду, чтобы получалось качественно. 

## DSL реального приложения

В реальном приложении мои тесты выглядят так:

```swift
let sut = RemittanceCoordinator(...) 

@Test(.dependencies { deps in
    deps.api = APIStub
        .builder()
        // New beneficiary
            .success(RemittanceAPI.countries(), .testMake())
            .success(RemittanceAPI.stub_beneficiaryFields_bankOfPakistan(), .testMakeNewBank()) 
            .success(RemittanceAPI.stub_beneficiaryRequest(), .testMake())
        // New loan
            .success(RemittanceAPI.stub_quote(), .testMake())
            .success(RemittanceAPI.stub_submitRemittance(), .testMake())
    .build()
})
func newBeneficiary_domesticTransactionInGreatBritain_shouldNotShowProvidersSelection() async throws {
    let sut = await makeSutAndStart()

    try viewModel(route: \.beneficiarySelection).createNewUser()
    try await viewModel(route: \.countries).selectUK()
    try await viewModel(route: \.userDetails).process(addBankDetails: true)
    try await viewModel(route: \.remittance).process(amount: 200, source: .from)

    let transactionVM = try #require(sut.showTransactionPopover)
    try await transactionVM.process()

    #expect(transactionVM.state == .success)
    analytics.expectSnapshot()
}
```

Это пример сложного тест-кейса, где нужно подменить 5 запросов, пройтись по 5 экранам и убедиться, что все данные передаются правильно в сценарии перевода денег в другую страну. Но с другой стороны: для тестирования такого сценария понадобилось всего 25 строк теста!

DSL в этом тесте помогает мне брать вьюмодели экранов и сводить действия на этом экране до одной строчки. В тесте несколько уровней DSL:
- `APIStub.builder()` позволяет управлять ответами от API.
- `testMake()` содержит фикстуру ответа.
- `makeSutAndStart()` упрощает создание тестируемого объекта: проставляет дефолтные значения для таймуатов, вызывает функции по запуску работы объекта. 
- `viewModel(route: \.countries)` – функция от `CathPathable`, которая позволяет получить из роутера вьюмодель текущего экрана.
- `createNewUser()`, `selectUK()` и другие — функции, которые выполняют основное действие на экране.
- `analytics.expectSnapshot()` – специальный ассерт, который собирает все данные аналитики и сравнивает с примером из файла. 

Выглядит так, будто весь тест состоит из разного вызова DSL и реального кода то и не проверяется! На самом деле это все поверхностный API для вызова реального кода и по такой структуре написаны все тесты в проекте.

Разные тесты имеют разную детализацию. Например, сложный экран ввода суммы для перевода денег в другую страну может иметь свой набор тестов для проверки разных состояний. Но при тестировании сценария перевода новому человеку весь экран сократится до одной функции `try await viewModel(route: \.remittance).process(amount: 200, source: .from)`. 

> Note: Разному уровню детализации разный DSL

@Comment {
    Добавить видео этого сценария чтобы понять как много мы протестировали. 
}

## DSL для UI-тестов

Особо сильно мощность DSL ощущается в UI-тестах. Доступ ко всем элементам на экране происходит через селекторы, работать с ними напрямую очень неудобно уже на третьем тесте. Слишком детально, слишком технологично, слишком сложно:

```swift
func addNewBeneficiary() {
    app.buttons["Pakistan"].firstMatch.waitAndTap()
    app.buttons["Albaker"].firstMatch.waitAndTap()
        
    app.textFields["IBAN"].tapAndType("01234567890123456789")
    app.textFields["First Name"].tapAndType("Homer")
    app.textFields["Last Name"].tapAndType("Simpson")
    app.textFields["Nickname"].tapAndType("Father")
        
        
    app.scrollViews["DetailsScrollView"].swipeUp()
    app.buttons["Friend"].tap()
    app.buttons["Continue"].firstMatch.tap()
        
    app.staticTexts["Remit"].wait()
}
```

Этот же тест, но уже через пейдж-обжекты.

```swift
func addNewBeneficiary(
    country: Country = .pakistan, 
    bank: Bank = .albakar
) {
    selectCountry(to: country)
    select(bank: bank)

    input(.iban, value: "01234567890123456789")
    input(.firstName, value: "Homer")
    input(.lastName, value: "Simpson")
    input(.nickname, value: "Father")

    scrollDetailsUp()
    select(.friend)
    tapContinue()

    waitForQuoteScreen()
}
```

Более того, в тестировании целого сценария это все ведь сокращается до одной строчки! 

```swift
func testNewBeneficiaryRemit() throws {
    let balance = main.failIfBalanceLess(than: 200)
    main.remitToNewBeneficiary()

    remit
        .addNewBeneficiary(country: .UK)
        .inputSendingAmountAndPay(to: 200)
        .waitQuoteAndPay()
        .confirmPasscode()
        .waitForSuccess()

    main.expectBalanceChange(to: balance - 200)
}
```

Подробнее про UI-тесты будет в главе <doc:UI-testing>

### Итог

DSL упрощает вызов продакшен-кода, от чего тесты проще читать, писать и поддерживать. Дальше мы рассмотрим подробно разные виды DSL и вы увидите, что там всегда скрывается лишь несколько строчек кода, а получается очень удобно.

@Comment {
    - Фаулер про DSL https://martinfowler.com/bliki/PageObject.html
    // TODO: описать где и как хранить дсл, как в целом я пишу тесты и не парюсь про его хранение.
}

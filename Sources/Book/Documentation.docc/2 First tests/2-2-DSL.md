# Domain Specific Language

Когда разработчики пишут первые тесты они обычно сильно стесняются написать немного дополнительного кода. Буквально пара лишних строчек создают ощущение, что это все нужно будет поддерживать, а абстракции в тестах больше мешают. 

Давайте пойдем от обратного: тест должен быть очень конкретный, очень понятный и скрывать лишние детали, потому что мы больше читаем код, а не пишем его. А если тест упал, то давать достаточно информации про состояние тестируемых объектов. 

Решить эту задачу помогает Domain Specific Language (DSL) – так называют весь код, который нужен только для тестов и который позволяет написать тесты красиво. Называется он так, потому что описывает операции которые происходят в вашей предметной области (т.е. домене), а вот вызывать внутри себя может довольно абстрактные функции. Проще запомнить как «DSL это просто код для красивых тестов».

## Overview

Каждый тест это минимум 10 строчек, если посчитать и пустые строки. Десяток тестов превращаются в сотни строк, который надо быстро читать, чтобы понять что уже протестировали, а что еще нет. Просто вызывать продакшен-код неудобно: тесты будут длинными и слишком детальными. 

Даже в простом задании на боулинг я уже использовал DSL. Если вызывать код напрямую, то тест будет непонятный, потому что в тесте не видно главного: первые два броска в сумме должны давать 10, чтобы удвоить следующий бросок. 

```swift
@Test func 'what is this test about'() {
    let game = Game()
    game.roll(4)
    game.roll(6)

    game.roll(6)

    #expect(game.score == 22)
}
```

Если мы вынесем создание объекта и добавим пару вспомогательных функций, то тест станет намного понятней:

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

Итоговый тест:
```swift
@Test func 'when two rolls are 10 in sum should double next roll`() {
    spare(first: 4)

    roll(6)

    #expect(score == 10 + 6*2)
}
```

В таком тесте сложнее ошибиться и проще читать. Но главное, что все тесты начинают опираться на единый вспомогательный код, поэтому при изменении продакшен-кода можно будет обновить код только внутри DSL — тесты останутся теми же самыми. 

## Единый уровень детализации

Главное правило понятного кода можно свети к такому: **внутри функции код должен иметь единый уровень детализации.** Правило подходит и для тестов тоже.  

DSL позволяет унести незначительные детали за пределы теста и выдержать единый уровень детализации внутри теста. . 

> Note: К тестам стоит применять все те же правила, что вы применяете к обычному коду, чтобы получалось качественно. 

## DSL реального приложения

В реальном приложении мои тесты выглядят так:
```swift
let sut = RemittanceCoordinator(...) 

@Test(.dependencies { deps in
    deps.api = APIStub.builder()
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
    sut.start()

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

DSL в этом тесте помогает мне брать вьюмодели экранов и сводить действия на этом экране до одной строчки. В итоге тест покрывает несколько экранов и проверяет целый сценарий перевода денег в другую страну. Перед тестом еще написаны стабы сети, но про это поговорим в главе про стаб сети <doc:Network>

> Note: Стабы сети это тоже DSL, они переиспользуются между разными тестами.

В тесте несколько уровней DSL:
- `APIStub.builder()` позволяет управлять ответами от API
- `testMake()` содержит фикстуру ответа 
- `viewModel(route: \.countries)` – функция от `CathPathable`, которая позволяет получить из роутера вьюмодель текущего экрана.
- `createNewUser()`, `selectUK()` и другие — функции, которые выполняют основное действие на экране.
- `analytics.expectSnapshot()` – специальный ассерт, который собирает все данные аналитики и сравнивает с примером из файла. 

Выглядит так, будто весь тест состоит из разного вызова DSL и реального кода то и не проверяется! На самом деле это все поверхностный API для вызова реального кода и по такой структуре написаны все тесты в проекте.

Тест может тестировать разный объем кода. Например, сложный экран ввода суммы для перевода денег в другую страну может иметь свой набор тестов для проверки разных состояний. Но при тестировании сценария перевода новому человеку весь экран сократится до одной функции `try await viewModel(route: \.remittance).process(amount: 200, source: .from)`. 

> Note: Разному уровню детализации разный DSL

@Comment {
    Добавить видео этого сценария чтобы понять как много мы протестировали. 
}

## DSL для UI-тестов

Особо сильно мощность DSL ощущается в UI-тестах: тестировать приходится через абстракцию в виде селекторов, поэтому читать становится невозможно. Если сократить до функций именно в нашем домене, то тест станет очень понятным.

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

@Comment {
    - Фаулер про DSL https://martinfowler.com/bliki/PageObject.html
    - написать про `makeSUT()`
}

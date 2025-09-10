# Мобильная пирамида тестирования

Пирамида тестирования необычная в мобиле, посмотрим на примеры тестов, которые стоит писать в проекте. 

## Overview

Тесты нежны разные, тестов будет много. Посмотрим из чего состоит мобильное приложение и чем нужно тестировать эти части. 

От простого к эзкотическому

### Верстка экранов

Скриншот-тесты позволят не только посмотреть на каждый экран в разных размерах, но и легко добавить дополнительных требований: темная тема, динамичный размер шрифта, написание справа-налево, скринридер и т.п.

Экранов много, на каждый нужно кучу снепшотов. 

Так же тестируются и компоненты дизайн-системы, а при изменении компонентов можно будет увидеть как дизайн-система повлияла на все экраны. 

Для полного покрытия нужно научиться работать с зависимостями и приводить экран в любое состояние. 

> Hint: если все это делать на уровне Preview, то Prefire позволит сгенерировать скриншот-тесты.  

```swift
#Preview("RemittanceScreen_eligible_initial") {
    RemittanceScreen(viewModel: withDependencies({ deps in
        deps.api = APIStub.builder()
            .success(
                RemittanceAPI.stub_rate(amount: 0), 
                .testMake(sending: 0, available_loan: .testMake())
            )
            .build()
    }, operation: {
        makeVMForPreview()
    }))
    .snapshot(delay: 0.1)
}
```

### Тестирование логики внутри экрана

- Часть презентационной логики советую захватить через скриншот-тесты. Например, я позволяю экрану стартануть и стабаю данные из сети, а затем смотрю как экран отобразил эти данные. Так захватывается разная логика по смене состояний, мапингу и т.п. при этом скорость не особо меняется, а вот мне меньше тестов писать. 

- Фейловые сценарии часто обрабатываются внутри экрана и не влияют на общий сценарий

> Hint: для простых экранов хватит скриншот-тестов, а сложных не так уж много. 

```swift
@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        .success(RemittanceAPI.stub_quote(), .testMake(rnpl: .testMake()))
        .success(RemittanceAPI.stub_submitRemittance(), .testMake())
        .build()
})
func whenEdit_shouldUseCorrectValues() async throws {
    try await sut.inputFromAndWaitQuote(200)
    sut.editLoan()
    try await sut.selectLoanAmountAndWait(10)
    sut.applyLoan()

    sut.editLoan()
    try await sut.selectLoanAmountAndWait(40)
    sut.applyLoan()

    try await sut.confirm()
}
```

Обычно приходится еще написать код так, чтобы его можно было вызывать через await:
```swift
func waitQuote() async throws {
try await #require(quoteTask).value
}
```

### Свойства поверх тестов

Имея такую систему можно в целом добавлять проверки в любое место: 
- Как быстро рендерятся экраны
- Есть ли утечки памяти
- Как можно читали данных с диска и т.п.

@Comment {
    // TODO: тесты про многопоточность
}

В таких тестах очень помогают снепшот-стратегии: поверх сценария можно снять слепок сетевых вызовов или аналитических событий. Вам не нужно писать строку на примере ниже, потому что она сгенерируется автоматически и подставятся прямо в код. Например, проверю как вызывались сетевые запросы в сценарии ввода суммы для кредита из теста выше. 

```swift
@Test(.dependencies { deps in
    // ...
})
func whenEdit_shouldUseCorrectValues() async throws {
    // ...

    assertInlineSnapshot(of: sut.loadingHistory, as: .dump) {
    """
    ▿ 3 elements
        ▿ RNPLLoadingRequest
            - amount: 200.0
            - amountSource: .from
            - loanAmount: "null"
        ▿ RNPLLoadingRequest
            - amount: 200.0
            - amountSource: .loan
            - loanAmount: "10.0"
        ▿ RNPLLoadingRequest
            - amount: 200.0
            - amountSource: .RNPL
            - loanAmount: "40.0"
    """
}
```


### Тестирование сценариев из нескольких экранов внутри модуля
Компонентные тесты, получение вьюмодели из тестов. 

```swift
@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        // Saved Beneficiaries
        .success(RemittanceAPI.savedBeneficiaries(), [.testMake()])
        // New beneficiary
        .success(RemittanceAPI.countries(), .testMake())
        .success(RemittanceAPI.providers(toCountry: .pak), [.testMake()])
        .success(RemittanceAPI.stub_beneficiaryFields_bankOfPakistan(), .testMakeNewBank())
        .success(RemittanceAPI.stub_beneficiaryRequest(), .valid(.testMake()))
        // New loan
        .success(RemittanceAPI.stub_quote(), .testMake())
        .success(RemittanceAPI.stub_submitRemittance(), .testMake())
        .build()
})
func newBeneficiary_newBank_shouldRouteToQuoteScreen() async throws {
    sut.start()

    try viewModel(route: \.beneficiarySelection).createNewUser()
    try await viewModel(route: \.countries).selectPakistan()
    try await viewModel(route: \.providers).selectNew()
    try await viewModel(route: \.userDetails).process(addBankDetails: true)
    try await viewModel(route: \.remittance).process(amount: 200, source: .from)

    let transactionVM = try #require(sut.showTransactionPopover)
    try await transactionVM.process()
}
```

В таких тестах функция целого экрана сводится до простых вспомогательных функций, например:
```swift
extension ProvidersViewModel {
    func selectNew() async throws {
        try await load()
        select(provider: nil)
    }
}
```

### Связи между модулями и бизнесовые сценарии
UI-тесты чтобы проверить слабосвязанные модули. Чаще всего вместе с тестированием поверх бэкенда, чтобы проверить общий сценарий. 

Для работы UI-тестов нужно обращаться к текстовому описанию элементов на экране, но это неудобно, поэтому создают специальные Page-Object, которые скрывают необычный API. От этого тест выходит довольно верхнеуровнево.

```swift
@MainActor
func test_connectAccount_addMoney_shouldTransferMoney() {
    launch(as: .accountWithoutConnectedBank)

    account.addMoney()

    XCTContext.runActivity(named: "Connect account") { _ in
        addMoney.connectNewAccount()
        addMoney.connectBank()
        addMoney.allowPermissions()

        openBankingWebView.connectAccount()
    }

    XCTContext.runActivity(named: "Payment") { _ in
        addMoney.input(amount: "100", pressPay: true)

        openBankingWebView.confirmPayment()
        addMoney.expectSuccessScreenAndClose()
    }
}
```

### Архитектурные тесты, которые единым правилом проверяют весь код

Если пойти чуть шире и представить тесты как «набор автоматических проверок поверх кода», то можно проверять не только функциональные свойства «что мы делаем», но и свойства самого кода. 

Такое позволяет сделать библиотека Harmonize. Например, тест, который проверяет, что все вьюмодели мы договорились делать через @Obsevable-макрос. 

```swift
@Test()
func allViewModels_shouldBeObservable() {
    let viewModels = Harmonize.productionCode()
        .classes().withSuffix("ViewModel")

    viewModels.assertTrue { viewModel in
        viewModel.attributes.contains { attribute in
            attribute.name == "Observable"
        }
    }
}
```

## Требования для тестов

### Контроль зависимостей

Сеть, время, настройки телефона, хранение файлов, состояние других частей приложения (например, баланс счета при переводе денег). 

В примерах выше я использую библиотеку [Swift Dependencies](https://github.com/pointfreeco/swift-dependencies), а как задизайнить зависимости для сети рассказываю в туториале <doc:tutorials/Network>

### Многомодульность
Тесты должны запускаться и прогоняться как можно быстрее, потому что тестов будет много. Чаще всего стоит разбить приложение минимум на несколько крупных модулей, которые вы будете тестировать по-отдельности. 

Например, в приложении для доставки еды: определение геолокации/адреса, выбор продуктов и настройка, добавление в корзину, регистрация, оплата, трекинг заказа, оценка после заказа. 

Минимальный банк: регистрация/открытие счета, пополнение счета, перевод денег, список транзакций. 

Работая с каждым модулем по-отдельности:
- Уменьшается размер задачи и количество кода
- Ускоряется сборка и прогон тестов
- LLM проще понимать контекст

### Вариативность

Контролируемые зависимости и многомoдульность позволяют делать разные версии приложений удобных для разработки. Например, можно убрать из билда все сложные зависимости про капчу, чат, Firebase и т.п., потому что для разработки они не нужны, так ускорится билд. 

Если с каким-то модулем приходится работать отдельно, то для него можно сделать демо-приложение. Так в Додо Пицце мы отделяли модуль оплаты и AR-пиццы. Для таких демо-приложений можно даже написать отдельные UI-тесты. Так мы тестировали десятки способов оплаты не создавая заказ. 

## Мониторинг и воспроизводимость

Любой баг с прода надо уметь повторять. Для этого вам нужно знать что человек сделал в приложении (часто — через аналитику) и какой ответ зависимостей был (из логов). 

## Ценность архитектуры

Чтобы писать все эти виды тестов понадобится разный набор инструментов и архитектурных решений. Пусть это делают самые сильные разработчики. 




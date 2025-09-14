# Тест-кейсы

Сначала поразмышляем как тесты должны выглядеть не естественном языке, чтобы разобраться что мы хотим получить в итоге.  

## Overview

<!--@START_MENU_TOKEN@-->Text<!--@END_MENU_TOKEN@-->

@Comment {
    // TODO: показать на видео сценарий который будем дальше обсуждать. 
}

## Описание сценария

В зависимости от типа теста подход к сценарию может быть разный.

### Тестирование чистой функции. 

- Настроили зависимости
- Вызвали функцию
- Проверили результат

### Тестирование сценария для класса
- Настроили состояние (иногда через зависимости)
- Вызвали все нужные методы
- Заснепшотили что происходило в процессе: аналитика, вызов сетевых функций и т.п.

Важное свойство таких тестов: код тестов может меняться внутри, но сам сценарий будет жить очень долго. 

> Note: важно выносить общие шаги подготовки или сценарий действий в красивый DSL, потому что такие тесты нужно будет писать десяток раз для одного объекта. Так будет проще поддерживать: меньше читать и быстрее чинить.  

> Tip: поверх таких сценариев можно делать и перформанс-тесты: как много данных мы скачали/записали, как быстро мы выполнили сценарий и т.п.

@Comment {
    TODO: Про KIF тут уместно напомнить
}

```swift
@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        .success(RemittanceAPI.stub_quote(), .testMake(rnpl: .testMake()))
        .success(RemittanceAPI.stub_submitRemittance(), .testMake())
        .build()
})
func whenEdit_shouldUseNewValue() async throws {
    try await sut.inputFromAndWaitQuote(200)
    try await sut.addLoan(10)
    
    try await sut.editLoan(40)
    try await sut.confirm()

    assertInlineSnapshot(of: sut.loadingHistory, as: .dump) {
        """
        ▿ 4 elements
            ▿ RNPLLoadingRequest
                - amount: 200.0
                - loanAmount: "null"
            ▿ RNPLLoadingRequest
                - amount: 200.0
                - loanAmount: "10.0"
            ▿ RNPLLoadingRequest
                - amount: 200.0
                - loanAmount: "40.0"
            ▿ RNPLLoadingRequest
                - amount: 200.0
                - loanAmount: "40.0"
        """
    }
}
```

@Comment {
    // TODO: Поменять название теста
}

> Tip: Короткие снепшоты можно хранить прямо в тестах, но большие стоит записывать в отдельный файл. Подробнее в главе про снепшот-тестирование

@Comment {
    Добавить ссылку. Есть туторил про сеть <doc:tutorials/Network>
}

@Comment {
    // TODO: сделать из этого урок с рефакторингом и оставить тут ссылку
}

### Тестирование сценария навигации
- Настроили зависимости
- Выполнили нужные шаги
- Опционально: проверили конечное состояние. Иногда в таких тестах финальной проверки даже нет, просто сам факт вызова всего кода без ошибок это уже цель. 

```swift
@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        // Saved
        .success(RemittanceAPI.savedBeneficiaries(), [])
        // New beneficiary
        .success(RemittanceAPI.countries(), .testMake())
        .success(RemittanceAPI.stub_beneficiaryFields_bankOfPakistan(), .testMakeNewBank()) // TODO: Add GBR details
        .success(RemittanceAPI.stub_beneficiaryRequest(), .valid(.testMake()))
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
    
    #expect(transactionVM.state.is(\.success))
}
```

### Скриншот-тесты

Стоит описать все состояния экранов, особенно те, до которых сложно дотянуться. Prefire соберет их все и заскриншотит. 

> Tip: добавляйте trait .sizeThatFitsLayout, чтобы размер картинок стал меньше. 

```swift
@available(iOS 17.0, *)
#Preview("Remittance initial", traits: .sizeThatFitsLayout) {
    RemittanceScreen(viewModel: withDependencies({ deps in
        deps.api = APIStub.builder()
            .success(RemittanceAPI.stub_quote(), .testMake())
            .build()
    }, operation: {
    // Создание вьюмодели дополнительно упрощено, потому что там десяток превьюшек 
        makeVMForPreview(amount: 0)
            .withZeroQuote() 
    }))
}

```

## Тестов будет много

- Качайте DSL
- Разбивайте требования

> Note: тесткейс это переключатели через который должен протечь ручеек теста и попасть в нужное место.

### Подготавливайте зависимости заранее. 

Может возникнуть соблазн менять поведение завимсимостей прямо во время выполнения теста: «я вот вызвал такую функцию, а ответ для нее должен быть вот такой по сети». В больших сценариях это работает плохо: появляется слишком много асинхронности. В долгосроке такой подход больше мешает, потому что прочитать описание всего что нужно для теста в начале, затем сценария поверх этих данных, а в конце уже посмотреть на результат.  

### Сложно написать лишь первый тест

Если вы смогли описать полный сценарий, то протестировать все побочные уже не составит труда. При этом часто выходит, что для целового модуля у вас лишь парочка основных сценариев на самом сложно экране + навигация внутри модуля, а все остальные тесты лишь поддерживают свои кейсы. При этом основной сценарий вы и руками сто раз прогоните, а вот все короткие дополнительные и будут вам помогать. 

### Тест-кейсы можно готовить заранее

- [ ] Про mermaid на входе и выходе. 

### Запишите тест-кейс, даже если лень писать тест

### Тест-кейсы могут стать спекой для LLM


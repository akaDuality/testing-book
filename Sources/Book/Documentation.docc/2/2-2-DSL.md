# Domain Specific Language

DSL: что такое и как работает на большом покрытии. Единый уровень детализации

## Overview

Каждый тест это минимум 10 строчек кода вместе с пустыми строками. Десяток тестов превращаются в сотни строк, который надо легко читать, чтобы понять что уже протестировали, а что еще нет. Просто вызывать продакшен-код не получится, тесты будут слишком детальными, поэтому вводят вспомогательный слой кода, который часто называют DSL. 

### Пример из каты про боулинг

Даже в простом задании на боулнг я уже использовал DSL. Если вызывать код напрямую, то тест будет непонятный:
```swift
@Test func whenTwoRollsAre10InSum_isSpare_thenNextRollScoredTwice() {
    game.roll(4)
    game.roll(6)

    game.roll(6)

    #expect(game.score == 22)
}
```

В тесте не видно главного: первые два броска в сумме должны давать 10, чтобы удвоить следующий бросок. 

Если мы введем дополнительную функцию, то тест станет намного понятней:

```swift
extension PlayerGame {
    func spare(first: Int = 4) {
        roll(first)
        roll(10-first)
    }
}
```

```swift
@Test func whenTwoRollsAre10InSum_isSpare_thenNextRollScoredTwice() {
    game.spare(first: 4)

    game.roll(6)

    #expect(game.score == 22)
}
```

В таком тесте сложнее ошибиться и проще читать. Но главное, что все тесты начинают опираться на единый вспомогательный код, поэтому после рефакторинга можно будет поправить код внутри DSL, а тесты останутся теми же самыми. 

> Note: по сути DSL это просто нормальный код тестов после рефакторинга. 

Другой тест из примера про боулинг целиком состоял из вызова DSL
```swift
@Test func when3StrikeInARow_FirstRollScores30Points_and2ndRollScored20Points() {
    strike()
    strike()
    strike()

    #expect(game.score == 130 + 20 + 10)
}
```

## DSL реального приложения

В реальном приложении мои тесты выглядят так:
```swift
@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        // New beneficiary
        .success(RemittanceAPI.countries(), .testMake())
        .success(RemittanceAPI.stub_beneficiaryFields_bankOfPakistan(), .testMakeNewBank()) // TODO: Add GBR details
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

        #expect(transactionVM.transaction != nil)
}
```

DSL в этом тесте помогает мне брать вьюмодели экранов и сводить действия на этом экране до одной строчки. В итоге тест покрывает несколько экранов и проверяет целый сценарий перевода денег в другую страну. Перед тестом еще написаны стабы сети, но про это поговорим в главе про стаб сети <doc:Network>

> Note: Стабы сети это тоже DSL, они переиспользуются между разными тестами. 

## Единый уровень детализации

Вообще правила написания и кода и тестов можно свети к одному:

> Note: внутри функции должен быть единый уровень детализации. 

DSL позволяет унести незначительные детали за пределы теста и выдержать единый уровень внутри. 


# Последовательное выполнение в тесте

Для тестов важно, чтобы код выполнялся последовательно: все подготовилось, выполнилось, пришло в финальную стадию, где можно проверять. Реальный код не всегда ведет себя так, поэтому давайте посмотрим на техники, которые помогают сделать выполнение кода последовательным 

### Выравнивание выполнения

Представим простую функцию:

```swift
@Observable
@MainActor
class ViewModel {
    var balance: Decimal = 0

    func updateBalance() {
        Task {
            self.balance = await apiClient.send(BalanceRequest())
        }
    }
}
```

И простой тест для нее:

```swift
@Test(.dependency({ deps in  
    deps.api = APIStub.builder() 
        .success(BalanceRequest(), .testMake(10))
        .build()
})
func `when load balance should store value`() {
    let sut = ViewModel()
    sut.updateBalance()
    #expect(sut.balance == 10)
}
```

Такой тест завалится, потому что обновление баланса уйдет в другой поток и его проверка вызовется раньше, чем выполнится запрос.

Разберем несколько способов как исправить

### 1. Сделать функцию асинхронно

Тесты умеют дожидаться ответа от асинхронных функци, поэтому мы можем убрать Task из тела функции вьюмодели. 

```swift
// ViewModel
func updateBalance() async { // add async
    self.balance = await apiClient.send(BalanceRequest())
}

@Test(.dependency({ ... })
func `when load balance should store value`() async { // Add async
    let sut = ViewModel()
    await sut.updateBalance() // add await
    #expect(sut.balance == 10)
}
```

При этом из View нам все равно надо вызывать функцию синхронно. Для этого можно сделать функцию-обертку на уровне View:

```swift
struct BalanceScreen: View {
    var body: some View {
        Text("Balance: \(viewModel.balance)")
            .onAppear(updateBalance)
    }

    @State viewModel = ViewModel()
    func updateBalance() {
        Task {
            await viewModel.updateBalance()
        }
    }
}
```
Таким образом получаем архитектурные правило: 
- Все функции презентера не должны прятать асинхронность
- Асинхронность уходит на уровень View 

### Как дождаться Task? DSL для асинхронности

Иногда модель должна управлять именно тасками. Например, на ввод каждого символа я создаю отложенную задачу на отправку данных на сервер через 0.2 секунды, но если ввели новый символ, то прошлую задачу отменяю и создаю новую. Получается, что нельзя вынести Task на уровень View и не получится сделать функцию асинхронной. Как тогда протестировать?

Воспользуемся тем, что результата работы Task можно дожидаться: `await Task { ... }.value`

Тогда можно сохранить Task в переменную и отдельной функций дожидаться результата
```swift
@Observable
@MainActor
class ViewModel {
    var balance: Decimal = 0

    var balanceTask: Task<Void, Never>?
    func updateBalance() {
        balanceTask = Task {
            self.balance = await apiClient.send(BalanceRequest())
        }
    }
}

// MARK: Test DSL
extension ViewModel {
    func updateBalanceAndWait() async throws {
        updateBalance() 
        let balanceTask = try #require(balanceTask)
        await balanceTask.value
    }
}
```

Тест сможет дождаться выполнения через DSL.

```swift

// MARK: Test DSL
extension ViewModel {
    func updateBalanceAndWait(sourceLocation: SourceLocation = #_sourceLocation) async throws {
        updateBalance() 
        let balanceTask = try #require(balanceTask, sourceLocation: sourceLocation)
        await balanceTask.value
    }
}

@Test(.dependency({ ... })
func `when load balance should store value`() async {
    let sut = ViewModel()

    await sut.updateBalanceAndWait()

    #expect(sut.balance == 10)
}
```

### Dependency и fireAndForget

Вообще к этому паттерну приходится прибегать довольно часто, поэтому в библиотеке Dependencies есть вспомогательная обертка `fireAndForget`. В продакшен-кода работает как обычный Task, а для тестового кода вызывается как `await Task { ... }.value`. 

```swift
private enum FireAndForgetKey: DependencyKey {
    public static let liveValue = FireAndForget { priority, operation in
        Task(priority: priority) { try await operation() }
    }
    public static let testValue = FireAndForget { priority, operation in
        await Task(priority: priority) { try? await operation() }.value
    }
}
```

Из-за этого в коде не нужно больше хранить Task в переменной и не надо писать DSL только для того чтобы протестировать функцию.  

```swift
func updateEmail(userID: UUID, newEmailAddress: String) async {
    try await self.database.updateUser(id: userID, email: newEmailAddress)

    await self.fireAndForget {
        try await self.sendEmail(
        email: newEmailAddress,
        subject: "You email has been updated"
    )
}
```

Есть и минусы:
- функция все равно должна быть асинхронной
- Не подходит, если Task вы сохраняли, чтобы его позже отменить. 

### Expectation для замыканий.

Если вы используете замыкания вместо async/await, то их завершение нужно дожидаться через [Expectation](https://developer.apple.com/documentation/xctest/asynchronous-tests-and-expectations). Не буду подробно останавливаться на том как они работают, про это очень много материалов. Отмечу важное: ожидания это часть DSL, лучше их скрывать во вспомогательных функциях, так тесты будет проще читать. 

```swift
extension MenuLoadingService {
    var expectation: XCTestExpectation?
    func expectLoadingCompletion(in suite: XCTestSuite) {
        suite.expectation(description: "Should complete loading")
    }

    func waitLoadingCompletion(in suite: XCTestSuite) {
        suite.wait(for: [expectation], timeout: 1.0))
    }
}

class MenuLoaderTests: XCTestSuite {
    func test_WhenLoadMenuShouldGroupProducts`() {
        let sut = MenuLoader()

        sut.expectLoadingCompletion(in: self)
        sut.loadMenu()
        sut.waitLoadingCompletion(in: self)

        XCTAssertEqual(sut.menuGroups.map(\.name) == ["Pizzas", "Combos", "Drinks"])
    }
}
```

Можно сократить еще сильнее, чтобы вызов функции стал полностью изолированным:

```swift
extension MenuLoadingService {
    func loadAndWait(in suite: XCTestSuite) {
        expectLoadingCompletion(in: suite)
        loadMenu()
        waitLoadingCompletion(in: suite)
    }   
}

class MenuLoaderTests: XCTestSuite {
    func test_WhenLoadMenuShouldGroupProducts`() {
        let sut = MenuLoader()

        sut.loadMenuAndWait()

        XCTAssertEqual(sut.menuGroups.map(\.name) == ["Pizzas", "Combos", "Drinks"])
    }
}
```

Когда-нибудь при миграции на async/await можно будет просто удалить код DSL.

Реализация для SwiftTesting: https://github.com/dfed/swift-testing-expectation

### Не вклиниваться в выполнение теста

В самом начале мне хотелось писать тесты в таком стиле:
- В программе нажал вот это
- Апи ответило вот это
- Потом сделали это
- А геолокация ответила вот так
- Тогда апи ответило вот это.

Но лучше завелся подход, когда мы в начале описываем поведение всех зависимостей, а затем описываем команды сценария. Так и с синхронностью меньше заморочек и одинаковые сценарии можно пропускать просто меняя поведение зависимостей.

@Comment {
    Будто это не здесь должно быть, а где-то рядом с примером из <doc:2-2-DSL>
}

### Самая важная зависимость

Для современных приложений важнее всего оказывается контроль над ответами API. Про это будет в отдельной главе <doc:3-2-network>, когда мы будем обсуждать тестирование вью-моделей

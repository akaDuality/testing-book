# Контроль над состоянием вьюшки

Разберемся как показывать вьюшку в разных состояниях

## Overview

Обычно для вьюшки нам надо уметь показывать ее в трех состояниях: данные, ошибка и загрузка. Увы, даже для такого простого случая нужно использовать разные инструменты. 

В этой статье разберем как задать произвольное состояние для вью, а в следующей посмотрим на контроль зависимостей (смотри статью <doc:Network>).

@Image(source: screen-states) {
    Состояния экрана: загрузка, данные, ошибка 
}

## Вьюшка для примера

Сделаем простую вьюшку сама стартует свой life-cycle:

```swift
struct SampleScreen: View {
    @State let viewModel: ViewModel

    var body: some View {   
        Text(viewModel.state)
            .onAppear(viewModel.onAppear)
    }
}

#Preview {
    SampleScreen(viewModel: ViewModel())
}
```

И вьюмодель для нее:

```swift
@MainActor
@Observable
class ViewModel {

    @CasePathable
    enum State {
        case loading, data(String), error
    }

    var state: State = .loading

    @Dependencies(\.api) var api

    func onAppear() {
        Task {
            state = .loading
            do {
                let response = try await api.getData()
                state = .data(response)
            } catch {
                state = .error
            }
        }
    }
}
```

@Comment {
    Рассказать про CasePathable
}

У такого кода есть несколько проблем тестируемости:
- функция загрузки переключает поток выполнения, поэтому будет сложно написать юнит-тесты.
- вьюшка сама запускает лайфсайкл, поэтому даже если мы застабаем данные, то легко проскочим состояние загрузки и не сможем его проверить через скриншот.

### Отделим асинхронность

Стаб ответов от сети приводит вьюшку в конечное состояние, но чтобы заскриншотить состояние загрузки нам нужно «подвиснуть». Это достаточно крайний случай, поэтому рассмотрим как подсовывать состояние в обход презентационной логики. 


В тестах нам лучше работать с асинхронностью напрямую, поэтому я разделю функцию на две: вьюмодель будет хранить асинхронный вариант, а вьюшка сама умеет обращаться к вьюмодели так, как ей удобно. Нам это еще пригодится позже.

```swift
@MainActor
@Observable
class ViewModel {

    // ...

    /// Функция во вьюмодели асинхронная, чтобы было удобно тестировать
    func load() async {
        state = .loading
        do {
            let response = try await api.getData()
            state = .data(response)
        } catch {
            state = .error  
        }
    }
}

struct SampleScreen: View {
    @State var viewModel: ViewModel

    var body: some View {   
        Text(viewModel.state)
            .onAppear(onAppear)
    }

    /// Вьюшка сама решает как ей правильно вызывать асинхронный код
    func onAppear() {
        Task {
            await viewModel.start()
        }
    }
}
```

Тест на загрузку данных достаточно простой:

```swift
@Test(traits: .dependency(\.api, APIStub.builder()
    .success(.data, .testMake())
    .build())
) {
func whenAppear_shouldLoadData() async {
    let sut = ViewModel()
    await sut.start()
    #expect(sut.state.is(\.data))
}
```

В идеале проверить не только конечное состояние, но и что мы правильно прошли промежуточные. Т.е. ожидаю такой текст:

```swift
@Test(traits: .dependency(\.api, APIStub.builder()
    .success(.data, .testMake())
    .build())
) {
func whenAppear_shouldLoadData() async {
    let sut = SpyViewModel()
    await sut.start()
    #expect(sut.stateHistory == [\.loading, \.data])
}
```

Написать такой тест поможет Spy-объект. Достаточно наследоваться от вьюмодели и перегрузить сеттер стейта:

```swift
class SpyViewModel: ViewModel {

    override var state: State {
        didSet {
            stateHistory.append(state)
        }
    }

    var stateHistory: [State] = [state]
}
```


Такой подход через «прослушивание» позволяет тестировать замороченные сценарии. Например, можем проверить все состояния при ретрае после неудачной загрузки:

```swift
@Test(traits: .dependency(\.api, APIStub.builder()
    .failure(.data)
    .success(.data, .testMake())
    .build())
) {
func whenAppear_shouldLoadData() async {
    let sut = SpyViewModel()
    await sut.start()
    await sut.retry()
    #expect(sut.stateHistory == [\.loading, \.error, \.loading, \.data])
}
```

При этом можно не писать состояния вручную, а использовать <doc:SnapshotTesting> чтобы посмотреть на поведение зависимостей. 


```swift
class RemittanceViewModelSpy: RemittanceViewModel {
    lazy var loadingHistory: [RNPLLoadingRequest] = []

    override func load(amount: Decimal, amountSource: AmountSource) async throws {
        try await super.load(amount: amount, amountSource: amountSource)
        loadingHistory.append(
            CurrencyRateRequest(
                amount: amount.double,
                amountSource: amountSource,
                loanAmount: (rnplToSend != nil ? String(rnplToSend!.double) : "null"))
            )
    }
}

@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        .success(RemittanceAPI.stub_quote(), .testMake(), numberOfAllowedCalls: 5)
        .build()
})
func whenEdit_andDecline_shouldSendRemittanceWithoutLoan() async throws {
    try await sut.inputFromAndWaitQuote(200)
    sut.editLoan()
    try await sut.selectLoanAmountAndWait(10)
    try await sut.reloadAmountAndWait()
    sut.applyLoan()

    sut.editLoan()
    sut.closeLoanPopoverAndDiscardChanges()
    try await sut.send()

    assertInlineSnapshot(of: sut.loadingHistory, as: .dump) {
        """
        ▿ 3 elements
            ▿ CurrencyRateRequest
                - amount: 200.0
                - amountSource: AmountSource.from
                - loanAmount: "null"
            ▿ CurrencyRateRequest
                - amount: 200.0
                - amountSource: AmountSource.loan
                - loanAmount: "10.0"
            ▿ CurrencyRateRequest
                - amount: 200.0
                - amountSource: AmountSource.from
                - loanAmount: "10.0"
        """
    }
}
```

> Tip: Инлайн-снепшоты сами подставят текст после первого вызова теста, вам остается только прочитать результат.

@Comment {
    Видео можно вставлять только в туториал
    @Video(source: "Network-shapshot.mov")
} 

### Останавливаем лайфсайкл

Для превью нам надо будет дополнительно остановить выполнение кода. Есть два подхода

#### Добавить флаг про старт лайфсайкла во вью

Другой способ: можно добавить специальный флаг для превью, который будет останавливать лайфсайкл и вызывать его только в тех превьюшках, где он нужен

Дополнительно `@FocusState`-свойства нельзя хранить во вьюмодели, но мы часто сталкиваемся с задачей, когда при открытии экрана надо сразу показать клавиатуру. Поэтому флаг `allowLifeCycle` стоит держать на уровне вьюшки, чтобы не захломлять вьюмодель.

```swift
struct SampleScreen: View {
    @Bindable var viewModel: ViewModel
    var allowLifeCycle: Bool = true

    @FocusState var showSearch = false

    var body: some View {   
        Text(viewModel.state)
            .onAppear(onAppear)

        TextField($viewModel.search)
            .focused($showSearch)
    }

    func onAppear() {
#if DEBUG
        guard allowLifeCycle else { return }
#endif
        showSearch = true
        Task {
            await viewModel.start()
        }
    }
}

#Preview {
    let viewModel = ViewModel()
    viewModel.state = .loading
    
    SampleScreen(viewModel: viewModel, allowLifeCycle: false)
}
```

Получилось, что функция `onAppear` получилась инфраструктурной, скрыла в себе все нюансы асинхронности, лайфсайкла и работы с фокусом, зато весь остальной код получилось удобно тестировать. Работу этой функции тестировать через юнит-тесты бесполезно, но вот UI-тесты легко проверят именно ее: и старт работы экрана и появление клавиатуры и на асинхронность им все равно.

Обратите внимание, как код для тестов исключен из продакшен-билда через `#if DEBUG`, чтобы ни в коем случае выполнение кода не прервалось у реального человека. 

@Comment {
    Prefire должен пережить смену контекста
}

#### Убрать выполнение onAppear в Spy-объекте

Раз у нас уже есть Spy-объект, то он же может останавливать автоматическое выполнение для UI-вызова. 

```swift
class SpyViewModel: ViewModel {

    override func start() {
        // Do not call super
        // super.start() 
    }
}
```
И использовать spy-модель для превью:

```swift
#Preview {
    let viewModel = SpyViewModel() // Этот объект не вызывает код во onAppear()
    viewModel.state = .loading // По-умолчанию уже в .loading, но можно указать явно. 

    SampleScreen(viewModel: viewModel)
}
```

Такое применение выглядит странновато, но иногда нам может быть полезно заглушить действие какого-то кода вынеся его в отдельную функцию. Чаще всего такое нужно в коде, в котором зависимости не отделили и нужно сделать код тестируемым минимальными изменениями в продакшен-кода. 

@Comment {
    придумать нормальный пример
}


### Архитектурные тесты

Все эти дополнительные требования можно записать в линтер или тестировать через Harmonize, смотри главу <doc:ArchitectureTests>

# Наглядные падения тестов

Самое сложное в поддержке тестов это быстро понимать почему тест упал и что сделать, чтобы исправить тест или понять ошибку в коде. Есть несколько техник и инструментов, которые помогают в этом

## Fail first

Все подходы к тестированию рекомендуют сначала написать падающий тест: 
- так вы убедитесь, что ошибка вообще была, что тест нужен, а затем вы ее исправили
- вы увидите как выводится ошибка и насколько она помогает понять проблему.

Как правило надо придумать лишь несколько стратегий по работе с ошибками на уровне архитектуры зависимостей, чтобы легко находить проблемы при прогоне тестов.

## throws в коде

Самый простой тип: если у вас есть throws функция и она вернет ошибку, то тест упадет. Главное не погасить ошибку в коде или на уровне теста, тогда сам тест тоже завершится с исключением и тест упадет.

```swift
@Test func canMakeRequest() async throws {
    let profile = try await apiClient.send(profileRequest())
    #expect(profile.name == "Homer Simpson")
}
```

При этом описание ошибки выведется как результат прогона теста. 

@Comment {
    Показать как выглядит ошибка
}

## Кастомные ассерты и место вызова

Часто в тест-кейсах нужно проверять одни и те же проверки. Например, в конце многих сценариев регистрации я проверяю, что пользователь авторизован. Каждый раз писать полную проверку на наличие токенов, номера телефона и userId странно, лучше вынести функцию проверки и переиспользовать

```swift
extension Storage {
    func expectAuthorized() {
        try #require(accessToken)
        try #require(refreshToken)
        try #require(phoneNumber)
        try #require(userId)
    }
}
```

Если проверка не очень очевидная, то можно добавить и дополнительное сообщение, оно покажется в случае ошибки. 
```swift
    try #require(userId, "can't read `userId` from `accessToken`")
```

@Comment {
     показать ошибку на скриншоте
}

В ассерты нужно еще передавать и `sourceLocation` — строка в тесте, где эта функция вызывается. Так ошибка отобразится в тесте, а не где-то в середине функции ассерта. Для этого добавим параметр со значением по-умолчанию и передадим его в каждый `#require` и `#expect` 

```swift
extension Storage {
    func expectAuthorized(
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        try #require(accessToken, sourceLocation: sourceLocation)
        try #require(refreshToken, sourceLocation: sourceLocation)
        try #require(phoneNumber, sourceLocation: sourceLocation)
        try #require(userId, sourceLocation: sourceLocation)
    }
}
```

@Comment {
    показать до и после 
}

Этот подход можно посмотреть в туториале <doc:2-1-TDD-Kata>



@Comment {
    Про CasePathable тут рассказать?
}

## Сравнение объектов

Для сравнения точечных значений assert/expect подходит хорошо, нормально написать пару expect в тесте. Сложнее, если параметров много: несколько проверок сильно увеличивают размера теста, их становится сложно переиспользовать между тестами, а добавление еще одного свойства потребует *не забыть* добавить его во все тесты. Нужно решение получше: например, свети все проверки до одного объекта. 

Для этого пригодится библиотека [Custom Dump](https://github.com/pointfreeco/swift-custom-dump): она позволяет сравнить объекты по каждому полю, при этом если значения отличаются, то она покажет только разницу между объектами (как это делает Git):

```swift
expectNoDifference failed: …

  User(
    favoriteNumbers: […],
    id: 2,
-   name: "Blob"
+   name: "Blob!"
  )

(First: −, Second: +)
```

Таким ассертом можно проверять по словарю, при падении он укажет какое именно значение разошлось с ожидаемым. 

```swift
@Test(.dependencies { deps in
    deps.api = APIStub.builder()
    .success(RemittanceAPI.stub_beneficiaryFields_bankOfPakistan(), .testMake())
    .success(RemittanceAPI.create(beneficiary: beneficiaryRequest), .valid(beneficiaryResponse))
    .build()
})
func shouldCreateBeneficiaryFromForm() async throws {
    try await sut.load()

    try sut.fill("01234567890123456789", for: "iban")
    try sut.fill("Homer", for: "first_name")
    try sut.fill("Simpson", for: "last_name")
    try sut.fill("Friend", for: "relationship")

    #expect(sut.formIsValid == true)
    try await sut.createBeneficiary()

    expectNoDifference(createdBeneficiary?.personal_details, [
        "full_name": "Homer Simpson",
        "first_name" : "Homer",
        "last_name" : "Simpson",
        "relationship": "Friend",
    ])
    expectNoDifference(createdBeneficiary?.bank_details, [
        "iban" : "01234567890123456789",
        "bank_code": "MEZNPKKA",
        "bank_name": "MEEZAN BANK LIMITED",
        "bank_id": "0efe4a1d-a138-4b23-ae11-4327c53f893d"
    ])
}
```

Для переиспользования проверяемые значения можно вынести из теста:

```swift
@Test(...)
func shouldCreateBeneficiaryFromForm() async throws {
    // ...
    try await sut.createBeneficiary()

    expectNoDifference(createdBeneficiary?.personal_details, .homerSimpson)
    expectNoDifference(createdBeneficiary?.bank_details, .meezan)
}
```

Сранвнение работает не только со словарем, но и с объектами:
- структуры сравниваются автоматически
- для классов надо реализовать протокол один из протоколов: CustomDumpStringConvertible, CustomDumpReflectable или CustomDumpRepresentable.

@Comment {
    Написать пример
}

Можно проверять совсем наоборот: явно указать какие значения должны поменяться, но чтобы остальное осталось без изменений. Для этого есть `expectDifference`:

```swift
struct Counter {
    var count = 0
    var isOdd = false

    mutating func increment() {
        self.count += 1
        self.isOdd.toggle()
    }
}

var counter = Counter()
    expectDifference(counter) {
        counter.increment()
    } changes: {
        $0.count = 1
        $0.isOdd = true
    }
```

Другие возможности описаны [в репозитории Custom Dump](https://github.com/pointfreeco/swift-custom-dump?tab=readme-ov-file#expectnodifference)

@Comment {
    можно даже специально приводить к одному объекту, но только в самых сложных кейсах. 
}

## Снепшот-тесты

Иногда проверяемые объект слишком большой, да настолько, что нам даже не очень важны все его параметры, хочется просто удостовериться, что ваши изменения сохранили ожидаемый результат. Например, мы хотим проверить все параметры которые отправили в событие аналитики. В таком случае проще сохранить весь пример отдельным файлом на диск. Подробно об этом мы поговорим в разделе про снепшот-тестирование <doc:SnapshotTesting>. Там же разбираем как не писать изменение для customDump вручную, а позволить ему сгенерироваться автоматически.  

## IssueReporting

Иногда нам нужно прокинуть источник ошибок очень далеко от теста: например, если мы хотим показать, что какой-то сетевой вызов забыли застабать. Для этого мы точно так же можем передать sourceLocation в конструктор зависимости, а потом подставить его в [`IssueReporting`](https://github.com/pointfreeco/swift-issue-reporting). Библиотека `IssueReporting` позволяет показывать фиолетовый варнинг при работе Preview и ронять тест, когда код неправильный код сработал в тестовом окружении.  

Смотри туториал <doc:tutorials/Network>

@Comment {
    
    Этот же подход поможет отлавливать ошибки при тестировании целых сценариев (обсудим позже в главе <doc:4-1-Navigation>): тест опишет успешный сценарий, но если на каком-то экране возникнет ошибка, то 

    ## Ошибки внутри экранов и ToastQueue

    - ошибки внутри экрана
    - лог шагов, чтобы быстро найти нужный
    - стаб аналитик


    дописать
}

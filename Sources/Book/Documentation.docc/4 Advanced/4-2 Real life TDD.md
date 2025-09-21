# Test Driven Development в приложении

Многие книги рекомендуют сначала написать тесты, а потом писать код. У меня редко так получается, но давайте посмотрим как может выглядеть разработка через тестирование. 


## Проверяем работу контракта

Главная наша цель тестирования — ускорить разработку. Для этого мы стабилизируем наши зависимости и перекладываем проверки на компьютер.

Начнем приложение с ноля и сделаем регистрацию по номеру телефона и смс. 

Первый код прямо в тестовом окружении, чтобы запускать код по сочетания `CMD+U`. Для начала мне надо сделать запрос, я пишу его прямо в тестовом таргете, чтобы не заниматься лишней работой по правильному расположению кода, указанию импортов и т.п. 

Еще первые тесты ходят прямо в сеть: так мы проверим, что правильно настраиваем зависимость. С бэкендом мы договорились про тестовый номер телефона и код от смс: так мы сможем проверить общую работу кода даже без подключения смс провайдера, это проверим в конце вручную. 

```swift
import Foundation

struct AuthRequest: Encodable {
    let phone: String
}

func makePhoneRequest(baseURL: String, phone: String) throws -> URLRequest {
    guard let url = URL(string: "https://\(baseURL)/auth") else {
        throw URLError(.badURL)
    }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let payload = AuthRequest(phone: phone)
    request.httpBody = try JSONEncoder().encode(payload)
    return request
}

@Test
func canAuth() async throws {
    let phoneRequest = try makePhoneRequest(baseURL: "example.com", phone: "+1234567890")

    let (data, response) = try await URLSession.shared.data(for: request)

    // Basic checks for demo purposes
    guard let http = response as? HTTPURLResponse else {
        throw URLError(.badServerResponse)
    }
    #expect(http.statusCode == 200)

    // Inspect response data if needed
    // print(String(data: data, encoding: .utf8) ?? "")
}
```

В таком виде много кода не напишешь, потому что уже после второго запроса текста станет очень много. Поэтому тест можно упростить до верхнеуровневого состояния:

```swift

@Suite
struct AuthTests {

    let client = APIClient(baseURL: ...)

    @Test
    func canAuth() async throws {
        let phoneRequest = makeAuthRequest(...)
        let token = try await client.send(authRequest)
    }
}
```

Теперь допишем второй запрос:

```swift
@Test
func canAuth() async throws {
    let phoneRequest = makeAuthRequest(...)
    let token = try await client.send(phoneRequest)

    let smsRequest = makeSMSRequest(token: token)
    let (accessToken, refreshToken) = try await client.send(smsRequest)
}
```

В обоих тестах нет `#expect`, потому что сам факт успешного получения данных и есть прохождение теста на текущем этапе. 

Сделаем третий запрос — мы прошли авторизацию и нам нужно получить профиль пользователя. Для нового запроса нам нужно передать ключ авторизации в хедерах:

```swift
@Test
func canAuth() async throws {
    let phoneRequest = makeAuthRequest(...)
    let token = try await client.send(phoneRequest)

    let smsRequest = makeSMSRequest(token: token)
    let (accessToken, refreshToken) = try await client.send(smsRequest)
    
    let profileRequest = profileRequest(accessToken)
    let profile = try await client.send(profileRequest)
}
```

Мы проверили, что можем авторизоваться и получить профиль, но в реальном приложении мы не будем вручную подставлять аксес токен в каждый запрос, а просто положим его в общедоступное хранилище и каждый запрос будет подставлять значение хедера автоматом. Перепишем это в коде, тест упростится, но продолжит проверять end-to-end вызовы.  

@Comment {
    // TODO: показать изменения в URLSession и что можно подставлять общие токены. 
}

```swift
@Test
func canAuth() async throws {
    let phoneRequest = makeAuthRequest(...)
    let token = try await client.send(phoneRequest)

    let smsRequest = makeSMSRequest(token: token)
    let (accessToken, refreshToken) = try await client.send(smsRequest)

    let profileRequest = profileRequest()
    let profile = try await client.send(profileRequest)
}
```

И вот теперь, когда абстракции по работе с сетью отделились от теста я переношу продакшен-код отдельно от тестов. 

## Разделяем навигацию

В тесте у нас получилось три шага, каждый из них будет представлен отдельным экраном с обработкой ошибок:
- Экран телефона добавит маску на ввод номера и завалидирует его
- Экран смс добавит таймер на повторные попытки
- Экран профиля отрисует полученные данные. 

Т.е. у каждого экрана будет какая-то вьюмодель, которая скрывает в себе тестовый запрос и будет общий класс, который скрывает за собой сценарий «введи телефон, затес смс, в конце покажи профиль. Сейчас эту роль выполняет тест, но нам надо ведь перенести код в продакшен. Обычно такие классы-сценарии называют координаторами. Подробнее в предыдущей главне <doc:Navigation> 

В итоге у нас есть координатор, который управляет сценарием, для чего создает вьюмодели и передает их в роутет. Роутер уже привзяан к платформе и сам может решить какой интерфейс выводить пользователю (UIKit или SwiftUI, показывать модально или в навигационном стеке). Протокол может быть такой:

```swift
@MainActor
protocol AuthRouterProtocol {
    func navigate(to route: AuthRoute)
}
```

Роутер это зависимость, поэтому для теста надо будет создать тестовый объект. Для начала реализуем протокол, где просто будем сохранять все переданные объекты. 

```swift
class AuthRouterSpy: AuthRouterProtocol {

    func navigate(to route: AuthRoute) {
        pathHistory.append(route)
    }

    var pathHistory: [AuthRoute] = []
}
```

В тесте я бы хотел получать вьюмодель последнего объекта, который показался на экране. В тесте я хочу обращаться примерно так `router.viewModel(for: \.sms)`, поэтому сделаю обертку, которая используя CasePaths будет возвращать последний объект. 


```swift
class AuthRouterSpy: AuthRouterProtocol {
    var pathHistory: [AuthRoute] = []

    func navigate(to route: AuthRoute) {
        pathHistory.append(route)
    }

    func viewModel<ViewModel>(
        for path: CaseKeyPath<AuthRoute, ViewModel>,
        sourceLocation: SourceLocation = #_sourceLocation
    ) throws -> ViewModel {
        try #require(pathHistory.last?[case: path], sourceLocation: sourceLocation)
    }
}
```

Заморочено, но вся сложность буквально в одном месте, интерфейс простой и тесты получатся отличными. 

## Тестируем координатор

Изменения в архитектуре изменят наш тест по форме, но не по сути: все так же хочется тестировать, что сценарий проходит, просто через другие объекты. Тест будет выглядеть так:


```swift
@Test
func canAuth() async throws {
    let sut = AuthCoordinator(api: ..., storage: ..., router: ...)
    
    sut.signUp()

    try await router.viewModel(for: \.phone).pass(number: "+44...")
    try await router.viewModel(for: \.sms).pass(sms: "123456")

    try #require(router.viewModel(for: \.sms))
}
```

В таком виде можно написать много разных тестов. Например, мы забыли пароль и для его восстановления надо пройти дополнительную проверку. Добавляем дополнительные кейс в AuthRoute и дописываем шаги к тесту

```swift
@Test
func firstLogin_whenRestorePasscode_shouldLogin() async throws {
    startRegistration()

    try await router.viewModel(for: \.phone).pass(number: phone)
    try await router.viewModel(for: \.sms).pass()
    try await router.viewModel(for: \.passcode).resetPasscode!()
    try await router.viewModel(for: \.faceCheck).pass()
    try await router.viewModel(for: \.passcode).pass()

    #expect(sut.storage.hasAuth == true)
}
```

Если я хочу убедиться в том, что запросы вызывались в правильном порядке, то я вызываю инлайн-снепшот и он сам подпишем что вызвалось.  

```swift
@Test
func firstLogin_whenRestorePasscode_shouldLogin() async throws {
    // ...

    api.expectInlineSnapshot {
        """
        /auth/phone
        /auth/sms
        /auth/reset-pass
        /auth/faceCheck
        /auth/new-passcode
        """
    }
}
```

## Скриншот-тесты

При разработке хочется быстрее сделать хоть какой-то визуал и понажимать руками: это подпитывает эмоционально, легко показывать на демо и успокаивает менеджера :D

@Comment {
    проверить, что есть глава про вьюмодели
}

Простые вьюмодели у нас уже есть, к ним же можно добавить и вьюшку. Вся сложность тестирования вьюшки спрячет Prefire и автоматические сгенерирует скриншот-тесты из `Preview`. Смотри главу <doc:3-3-preview-prefire>

## Стабилизация зависимостей

@Comment {
    рассказать про DSL
    и про асерт сети
}

К этому моменты обычно уже оказывается, что я либо хочу стабилизировать контракт зависимостей либо попадается что-то, что нужно замокать. Например, при сбросе пароля банки запрашивают видеосъемку лица для подтверждения личности. У нас нет цели тестировать само распознание: это долго + внешний сервис (и платный к тому же), поэтому нужно придумать как его обходить.   

```swift
@Test(.dependencies { deps in
    // Have been logged in already
    deps.storage.accessToken = "access"
    deps.storage.refreshToken = "refresh"
    deps.storage.phoneCode = "+44"
    deps.storage.phoneNumber = "923847"

    deps.api = APIStub.builder()
        .success(AuthorizationAPI()
        .resetPasscode(accessToken: "access", refreshToken: "refresh", tempToken: nil), .testMake(nextAction: .face_check, ))
        .success(AuthorizationAPI.completeFaceCheck(check_id: "sdk_token", device_id: "1234"),
        .testMake(nextAction: .setup_passcode))
        .success(AuthorizationAPI.setupPasscode(
        .init(tempToken: "", passcode: "123456", deviceId: "1234")),
        .testMake(nextAction: .authentication_completed))
        .build()
})
func passcodeCheck_whenRestorePasscode_shouldLogin() async throws {
    @Dependency(\.kyc) var kyc
    let kycFake = try #require(kyc as? KYCFake)

    startPasscodeCheck()

    try await router.viewModel(for: \.phone).pass(number: phone)
    try await router.viewModel(for: \.sms).pass()
    try await router.viewModel(for: \.passcode).resetPasscode!()
    try await router.viewModel(for: \.faceCheck).pass()
    try await router.viewModel(for: \.passcode).pass()

    #expect(kycFake.isCalled == true, "Show KYC")
    #expect(didCheckPasscode == true)
    #expect(sut.storage.hasAuth == true)

    api.expectInlineSnapshot {
        """
        /auth/phone
        /auth/sms
        /auth/reset-pass
        /auth/faceCheck
        /auth/new-passcode
        """
    }
}
```

## Юнит-тесты на вьюмодели


## Устойчивость к изменениям

Мы пишем тесты так, чтобы все входные сигналы управлялись через зависимости объекта. Так наши тесты будут устойчивы к рефакторингу. 

Например, сначала мы сделали, что экран ввода телефона отправляет телефон на бэкенд, чтобы прислать смс, а экран смс отправляет запрос на подтвеждение кода из смс. Но затем мы поняли, что экран смс еще и повторно должен запрашивать смс, если таймер истек, а значит, что оба запроса было бы удобно делать с экрана смс. На тесты такое изменение не повлияет: контракт не изменился, сценарий тоже, поэтому тест сможет проверить точность наших изменений. 

@Comment {
    нужна иллюстрация до и после, а то сложно
}

На тесты повлияет изменение контракта. И с одной стороны, это нормально и правильно: мы вносим изменения и смотрим, выдерживает ли наша система эти изменения. С другой используя дополнительные `.testMake()` с дефолтным параметрами и DSL для сценариев мы переиспользуем вспомогательный код и их интерфейс довольно устойчив к изменениям.

Последний критерий устойчивости: мы должны легко понимать почему наш тест не прошел. Тесты на сценарий могут подвисать если один из экранов получил ошибку или мы не застабали какой-нибудь запрос. Быстро найти место ошибки позволит `IssueReporting`. 

@Comment {
    Написать главу про IssueReporting и примеры про стабы сети и BlackBox при ошибках
}

## Повторить

В итоге получается, что у нас есть тесты относительного одного модуля приложения, где все зависимости отделены от логики, а значит, что мы понимаем все входные сигналы для нашего кода. Если нам сообщат про баг на продакшене, то мы сможем посмотреть что произошло и воспроизвести: 
- что нажал пользовать
- какой ответ был от бэкенда
- какие настройки телефона были. 

Так мы сможем двигаться вперед все больше узнавая и фиксируя поведение зависимостей. 

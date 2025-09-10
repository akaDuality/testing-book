# Сеть

Самая главная и важная зависимость для приложений: API вашего сервиса и взаимодействием с ним.  

## Overview

Как верхнеуровнево замокать сеть. URLProtocol для более подробного мока, библиотеки `Mocker` и `OHHttpStubs`.


## Тестируемся сеть

Больше всего мобила зависит от сети и для тестирования надо уметь мокать сеть разными способами, зависит от уровня того, что именно вы хотитет протестировать. 

**Низкоуровневый.** Например, если вы тестируете работу капчи или рефреш-токенов, то лучше подменять на уровне URLProtocol, так вы сможете напрямую контролировать URLSession и ее ответы. Это делают библиотеки OHHTTPStubs или Mocker. Дополнительные интерфейсы в этом случае не нужны!

**На уровне фичи.** Если вы пишите фичу, то удобнее упростить интерфейс и работать просто с ответами на ваши запросы, контракт которых может вообще генерироваться автоматически. Чтобы это максимально коротко получилалось, например так: 

```swift
APIStub.success(WaitlistAPI.rating(), .testMake())
```

Первый параметр это описание моего запроса, а второй это ответ на него. Тут интересная функция testMake: прямо на уровне сети я описываю доступные примеры использования, чтобы не париться по месту вызова. Выходит так:
```swift
static func rating() -> Request<RatingDTO> {
    Request(path: "/waitlist/rating", method: .get)
}

struct RatingDTO: Codable, Sendable, Equatable {
    let userPlace: Int
    let totalUsers: Int

    static func testMake() -> Self {
        Self(
            userPlace: 300,
            totalUsers: 21342134,
        )
    }
}
```

При этом подмену ответа можно делать разными способами, смотря что больше подходит:
- Через `Decodable`-объект для обычной фичи
- Через строчку-джейсон, который вы только что описали в документации пока бэкенда нет.
- Читать из файла, когда джейсон слишком большой и хранить его на уровне файла с тестом уже не хочется. В этом случае еще может помочь [PreviewModifier](https://developer.apple.com/documentation/SwiftUI/PreviewModifier)

В итоге это можно использовать не только для тестов, но и для превью. При этом для целого экрана можно заменить пачку запросов, у меня так сейчас работает:

```swift
import API
import Dependencies

#Preview {
    let viewModel = withDependencies({ deps in
        deps.api = APIStub.builder()
            .success(WaitlistAPI.rating(), .testMake())
            .success(WaitlistAPI.weeklyChallenge(), .testMake())
            .success(WaitlistAPI.rewards(), .testMake())
            .build()
        }, operation: {
            WaitlistViewModel(
                inviteCode: "Test invite",
                startBanking: {},
                logout: {})
        }

    WaitlistScreen(viewModel: viewModel)
}
```

Через `PreviewModifer` это будет работать даже прикольней. То, что это доступно лишь с iOS 18 не проблема, потому что легко гасится через available, но `Prefire` не умеет с трейтами работать, про него будет следующий пост.

```swift
@available(iOS 18.0, *)
#Preview(traits: .dependency(\.api, APIStub.builder()
    .success(WaitlistAPI.rating(), .testMake())
    .success(WaitlistAPI.weeklyChallenge(), .testMake())
    .success(WaitlistAPI.rewards(), .testMake())
    .build())
) {
    let viewModel = WaitlistViewModel(
        inviteCode: "Test invite",
        startBanking: {},
        logout: {})

    WaitlistScreen(viewModel: viewModel)
}
```

Такой подход можно использовать не только для превьюшек, но и перегружать зависимости. Например, сделать фичу целиком на стабах, дать дизайнеру и QA посмотреть, постепенно заменять на данные с бэкенда

### Live, Tests, Preview

Если превью или тест позволяют повторить кусочек сценария, то я могу запускать его в разных окружениях и это очень удобно. 

Например, прошлый пример показывал стабы, но можно и на реальном окружении запустить:

```swift
@available(iOS 18.0, *)
#Preview(traits: .dependency(\.api, .live) {
    WaitlistScreen(…)
}
```

Но для этого придется авторизацию проходить, тогда можно такое сделать:

```swift
@available(iOS 18.0, *)
#Preview(traits: .dependency(\.api, .preview(.testCredentials)) {
    WaitlistScreen(…)
}
```

В итоге либа позволяет создать три типа зависимостей: live, preview и tests, они будут сами подставляться в нужные места, а иногда можно и поменять окружение. Подробней в документации, а то там еще каскадные подмены есть 😄


## URLProtocol для любого тестирования сети

Иногда верхнеуровневого тестирования недостаточно и хочется тестировать ближе к URLSession. Из коробки Apple представляет расширение через URLProtocol, который можно использовать и для тестирования сети. Способ замороченный, потому что URLProtocol можно привязать только статически и в тестах это неудобно, поэтому проще использовать библиотеку для тестирования. 

- [OHHttpStubs](https://github.com/AliSoftware/OHHTTPStubs) 
- [Mocker](https://github.com/WeTransfer/Mocker) 

@Comment {
    // TODO: Написать примеры
}

### Пример на Mocker

> Tip: фреймворки стоит использовать только внутри DSL, а не как часть тестов. Так вы сможете переиспользовать их между тестами + легко будет сменить один фреймворк на другой. 

``` swift 
extension API {
    public func stubError<T>(
        _ request: Request<T>,
    ) {
        Mock(url: url(path: request.url!.relativePath),
            statusCode: 404,
            data: [request.methodForMock: Data()],
            requestError: ApiError.example) // Error is needed only for 5xx errors
        .register()
    }

    public func stub401Error<T>(
        _ request: Request<T>
    ) {
        Mock(url: url(path: request.url!.relativePath),
            statusCode: 401,
            data: [request.methodForMock: Data()])
        .register()
    }
}
```

Потому что ваши тесты должны оставаться на одном уровне детализации 

```swift
func stub401AndNextRequests() async throws {
    await api.stub401Error(MeAPI.detailedStatus())
    await api.stub401Error(AuthorizationAPI.refreshToken(access: "123", refresh: "123"))

    try await api.stubSuccessAuth()
    try await api.stubSuccess(MeAPI.detailedStatus(), "MeDetailedStatus_2_Complete", .apiStubs)
}

// Got 401 on user restoration
// Fail token refreshing (ex: have been logged in from another device)
// Show login screen (passcode should be hidden!)
// Login by phone and OTP
// Continue the failing request, should complete successfully
@Test
func hasAuth_whenGot401OnUserRestoration_shouldHidePasscode() async throws {
    try await stub401AndNextRequests()

    storage.simulateAuth(passcode: "555555")

    sut.start()

    let passcode = try #require(sut.passcodeManager.viewModel)
    await passcode.inputByCharacter("555555")

    #expect(sut.passcodeManager.isPresented == false, "hide passcode") // TODO: Read history of changes
    #expect(sut.state.is(\.main))
}
```
@Comment {
    // TODO: Надо тест попроще
    
    добавить про снепшот-тестирование
}

### Tutorial

<doc:tutorials/Network>

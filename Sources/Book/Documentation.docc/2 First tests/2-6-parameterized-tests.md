# Тесты с параметрами

Если мы сделали функцию чистой и все параметры видны на входе, то нам захочется вызвать ее несколько раз с разными параметрами. В таком случаем каждый раз придумывать название теста может быть слишком скучным, а код тестов получится слишком большим. Для упрощения удобно описать входные параметры и ожидаемый результат, тесты сгенерируются автоматически. 

## Задачка

Допустим у нас такая задача: 
- нужно сгруппировать транзакции по дате, 
- отдельно подписать даты «сегодня» и «вчера», 
- остальным поставить «день и месяц», 
- а если платеж был в прошлом году, то надо подписать и год. 

Т.е. у нас в самом описании задачи есть пяток требований, а еще много разных пограничных может быть, поэтому на одну функцию набирается десяток тест-кейсов. 

### Даты в тесте

Нам нужно тестировать разные даты, поэтому для начала научимся их легко описывать. Для этого создадим нужный нам форматтер. В тестах важна дата, но не важно время, поэтому опишем формат через дату. 

```
/// Helper to create a Date from "yyyy-MM-dd" string
class TestDateFormatter: DateFormatter {
    init() {
        self.dateFormat = "yyyy-MM-dd"
    }

    static func date(_ text: String) -> Date {
        TestDateFormatter().date(from: text)!
    }
}

```

Так мы сможем создавать нужные даты:

```swift
let date = TestDateFormatter.date("2025-02-03")

```

### Зависимость на дату

Для задачи важно, что она зависит и от текущего времени и от времени платежа. Значит, нам нужно уметь задавать текущую дату. Подробно про вермя было в главе <doc:2-3-dependencies-basic>

В тесте можно будет передать нужную даты в замыкании:
```swift
@Test
func today() {
    let paymentDate = TestDateFormatter.date("2025-02-03")
    let now = TestDateFormatter.date("2025-02-03")
    let formatter = PaymentDateFormatter(now: { now })

    let result = formatter.string(from: paymentDate)

    #expect(result == "Today")
}
```

### Параметризованный тест

Можно описать массив параметров. Этот тест слегка вымученный, но самый простой: перечислите массив параметров и тест вызовется с каждым из них.

```swift
@Test(arguments: [
    "2025-02-02", // Yesterday
    "2025-01-03", // Month ago
    "2024-02-03", // Year ago
])
func notTodayFeb03(paymentDate: String) {
    let now = TestDateFormatter.date("2025-02-03")
    let formatter = PaymentDateFormatter(now: { now })

    let result = formatter.string(from: paymentDate)

    #expect(result != "Today")
}
```

### Описываем формат параметра для теста

Чаще нужно передавать сразу несколько параметров, как минимум входное значение и ожидаемый результат. В таком случаем опишем структуру параметров и будем передавать ее.

```swift
@Suite
class TransactionDateFormatterTests {

    struct Params {
        let now: String
        let payment: String
        let expect: String
    }

    @Test(arguments: [
        Params(now: "2025-02-03", payment: "2025-02-03", expect: "Today"),
        Params(now: "2024-02-29", payment: "2024-02-29", expect: "Today"),
        Params(now: "2025-02-01", payment: "2025-02-01", expect: "Today"),
        Params(now: "2025-02-03", payment: "2025-02-02", expect: "Yesterday"),
        Params(now: "2025-02-01", payment: "2025-01-31", expect: "Yesterday"),
        Params(now: "2025-01-01", payment: "2024-12-31", expect: "Yesterday"),
        Params(now: "2025-02-03", payment: "2025-01-02", expect: "2 January"),
        Params(now: "2025-02-03", payment: "2025-01-03", expect: "3 January"),
        Params(now: "2025-02-03", payment: "2025-02-01", expect: "1 February"),
        Params(now: "2025-02-03", payment: "2024-02-02", expect: "2 Feb 2024"),
        Params(now: "2025-02-03", payment: "2024-02-03", expect: "3 Feb 2024"),
        Params(now: "2025-02-03", payment: "2025-01-15", expect: "15 January"),
        Params(now: "2025-02-03", payment: "2024-01-15", expect: "15 Jan 2024"),
    ])
    func transaction(of params: Params) {
        let mockNow = TestDateFormatter.date(params.now)
        let payment = TestDateFormatter.date(params.payment)

        let dateFormatter = TransactionDateFormatter(now: { mockNow })
        let result = dateFormatter.string(from: payment)

        #expect(result == params.expect)
    }
}
```

Можно и просто через turple описать параметры, но если вы ошибетесь, то компилятору будет сложнее показать место ошибки. 
```swift
@Test("Shows phone number only for Russia", arguments: [
    (countryNumericCode: CountryNumericCode.ru, cityPhone: "+7800 302-00-69", countryPhone: "+7 499 444-55-66", expectedPhone: "+7 800 302-00-69"),
    (countryNumericCode: .ru, cityPhone: "", countryPhone: "+7 499 444-55-66", expectedPhone: "+7 499 444-55-66"),
    (countryNumericCode: .us, cityPhone: "+1 555 123-4567", countryPhone: "+1 800 555-0100", expectedPhone: nil)
])
@MainActor
func showsPhoneNumberOnlyForRussia(
    countryNumericCode: CountryNumericCode, cityPhone: String, countryPhone: String, expectedPhone: String?
) throws {
    // ...
}
```

### Поясняем ошибки

В таком описании параметры становятся совсем уж магическими, поэтому стоит прокинуть и поясняющий текст 

```swift
@Suite
class TransactionDateFormatterTests {

    struct Params {
        // ...
        let message: Comment? // Добавим message в качестве параметра

        init(
            // ...
            _ message: Comment? = nil
        ) {
            // ...
            self.message = message
        }
    }

    @Test(arguments: [
        Params(now: "2025-02-03", payment: "2025-02-03", expect: "Today"),
        Params(now: "2024-02-29", payment: "2024-02-29", expect: "Today"),
        Params(now: "2025-02-01", payment: "2025-02-01", expect: "Today"),
        Params(now: "2025-02-03", payment: "2025-02-02", expect: "Yesterday"),
        Params(now: "2025-02-01", payment: "2025-01-31", expect: "Yesterday", "jump over month"),
        Params(now: "2025-01-01", payment: "2024-12-31", expect: "Yesterday", "jump over year"),
        Params(now: "2025-02-03", payment: "2025-01-02", expect: "2 January"),
        Params(now: "2025-02-03", payment: "2025-01-03", expect: "3 January", "Month diff not `today`"),
        Params(now: "2025-02-03", payment: "2025-02-01", expect: "1 February", "2 days diff in month"),
        Params(now: "2025-02-03", payment: "2024-02-02", expect: "2 Feb 2024", "year diff not `yesterday`"),
        Params(now: "2025-02-03", payment: "2024-02-03", expect: "3 Feb 2024", "2 days year diff"),
        Params(now: "2025-02-03", payment: "2025-01-15", expect: "15 January", "just a date"),
        Params(now: "2025-02-03", payment: "2024-01-15", expect: "15 Jan 2024", "full date with year"),
    ])
    func transaction(of params: Params) {
        // ...
        #expect(result == params.expect, params.message) // Объясним причину падения теста
    }
}
```
@Comment {
    показать картинку
}


Полный код примера

```swift
@Suite
class TransactionDateFormatterTests {

    struct Params {
        let now: String
        let payment: String
        let expect: String
        let message: Comment?

        init(
            now: String,
            payment: String,
            expect: String,
            _ message: Comment? = nil
        ) {
            self.now = now
            self.payment = payment
            self.expect = expect
            self.message = message
        }
    }

    @Test(arguments: [
        Params(now: "2025-02-03", payment: "2025-02-03", expect: "Today"),
        Params(now: "2024-02-29", payment: "2024-02-29", expect: "Today"),
        Params(now: "2025-02-01", payment: "2025-02-01", expect: "Today"),
        Params(now: "2025-02-03", payment: "2025-02-02", expect: "Yesterday"),
        Params(now: "2025-02-01", payment: "2025-01-31", expect: "Yesterday", "jump over month"),
        Params(now: "2025-01-01", payment: "2024-12-31", expect: "Yesterday", "jump over year"),
        Params(now: "2025-02-03", payment: "2025-01-02", expect: "2 January"),
        Params(now: "2025-02-03", payment: "2025-01-03", expect: "3 January", "Month diff not `today`"),
        Params(now: "2025-02-03", payment: "2025-02-01", expect: "1 February", "2 days diff in month"),
        Params(now: "2025-02-03", payment: "2024-02-02", expect: "2 Feb 2024", "year diff not `yesterday`"),
        Params(now: "2025-02-03", payment: "2024-02-03", expect: "3 Feb 2024", "2 days year diff"),
        Params(now: "2025-02-03", payment: "2025-01-15", expect: "15 January", "just a date"),
        Params(now: "2025-02-03", payment: "2024-01-15", expect: "15 Jan 2024", "full date with year"),
    ])
    func transaction(of params: Params) {
        let mockNow = mockDate(for: params.now)
        let transaction = mockDate(for: params.payment)

        let dateFormatter = TransactionDateFormatter(now: { mockNow })
        let result = dateFormatter.string(from: transaction)

        #expect(result == params.expect)
    }

    /// Helper to create a Date from "yyyy-MM-dd" string
    private func mockDate(for dateString: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: dateString)!
    }
}
```

### Минусы тестов с параметрами

У параметризованных тестов есть минусы и они связаны с поддержкой в Xcode. С одной стороны, Xcode видит все параметры как отдельные тесты. С другой, «увидит» он это только после первого прогона тестов. А может и не увидеть, тогда запустить лишь один конкретный параметр вообще не получится. 

@Image(source: parameterized-test-split) 

### Несколько параметров. 

В функцию теста можно передавать несколько параметров. Если задать целый массив значений для параметров, то каждое значение из первого массива протестируется с каждым значением из второго. Это может быть удобно если вам нужно протестировать целую матрицу значений. А если не нужно, то используйте `zip`, чтобы превратить значений в пары.  

Вызовет тест 9 раз:

```swift
@Test("Product is even", arguments: [2, 8, 50], [3, 6, 9])
func productEven(value: Int, multiplier: Int) {
    let product = value * multiplier
    #expect(product.isMultiple(of: 2))
}
```

Вызовет 6 раз:
```swift
@Test("Product is even", arguments: zip([2, 8, 50], [3, 6, 9]))
func productEven(value: Int, multiplier: Int) {
    let product = value * multiplier
    #expect(product.isMultiple(of: 2))
}
```

Пример взять с сайта [UseYourLoaf](https://useyourloaf.com/blog/swift-parameterized-testing/), читайте подброней там или [в документации Apple](https://developer.apple.com/documentation/testing/parameterizedtesting)




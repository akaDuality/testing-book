# test-profiling

<!--@START_MENU_TOKEN@-->Summary<!--@END_MENU_TOKEN@-->

## Overview


### Ускоряем тесты

Может оказаться неожиданным, что такие простые тексты на создание строчки выполняются 0.3 секунд на процессоре М1. Цифра может показаться небольшой, но мы отформатировали всего 14 строчек, это слишком долго. Если нам придут сотни транзакций, а группироваться они будут на старом телефоне в режиме энергосбережения. С другой стороны, скорость каждого теста тоже важна в долгосроке: тестов будут тысячи, суммарное выполнение превратится в минуты. 

@Comment {
    Показать как мы через профайлер находим причину ошибки
}


Самая медленная часть наших тестов: на каждый пример мы создаем несколько дейт форматтеров, хотя формат не меняется. Если форматтер для моков и тестируемый форматтер сделать статичными, то создаваться на каждый тест они не будут.  

```swift
@Test(arguments: [
// ...
])
func transaction(of params: Params) {
let mockNow = mockDate(for: params.now)
let transaction = mockDate(for: params.payment)

Self.sut.now = { mockNow }
let result = Self.sut.string(from: transaction)

#expect(result == params.expect, params.message)
}

static var sut = TransactionDateFormatter()

static var mockFormatter: DateFormatter = {
let formatter = DateFormatter()
formatter.dateFormat = "yyyy-MM-dd"
return formatter
}()

// Helper to create a Date from "yyyy-MM-dd" string
private func mockDate(for dateString: String) -> Date {
return Self.mockFormatter.date(from: dateString)!
}
```

После рефакторинга скорость выполнения тестов сократилась с 340 миллисекунд до 145 миллисекунд, т.е. на 60%. Стоит оптимизировать тесты выполнение которых превышает секунды, в примере выше мне важнее было показать что можно делать с тестами и статичными проперти. Скорость парсинга дат для всех платежей нам все еще важна, но это нужно тестировать именно в парсинге. Например, там можно проверить, что форматтер создавался только один раз.

@Comment {
    Написать пример про тестирование производительности. 
}

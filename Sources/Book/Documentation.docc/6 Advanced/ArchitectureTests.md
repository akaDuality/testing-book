# Архитектурные тесты

## Overview

С помощью архитектурных тестов вы можете написать правила которым должен следовать код. Отчасти эту же задачу выполняет и линтер, но через тесты у вас больше контроля, проще код и правила описаны на Swift. 

### Единые правила для кода

Написал кучу кода, добавил логаут и… посыпалось: после логаута видно, как основная часть приложения течет, потому где-то по пути я пропустил [weak self]. Точечно проблемы я нашел и починил, но хочется более системное решение. 

Натолкнулся на фреймворк для архитектурных тестов Harmonize. Статья обещала автоматически находить все замыкания, которые берут self и написать правила поверх них, поэтому взял попробовать. 

В целом клевый фреймворк: в противовес линтеру позволяет писать тесты на Свифте. Для разминки написал парочку сценариев, получаются довольно короткими.

Все делагаты должны быть подписаны как weak var delegate:
```swift
@Test()
func everyDelegatePropertyShouldBeMarkedAsWeak() {
    let classes = Harmonize.productionCode()
        .classes()

    let delegates = classes
        .variables().withNameContaining("delegate")

    delegates.assertTrue(message: "delegates should be weak or unowned") { delegate in
        delegate.hasModifier(.weak)
        || delegate.hasModifier(.unowned)
    }
}
```

NavigationStackController хранится в роутере и тоже должен быть слабой ссылкой, потому что он хранит вьюшку, вьюшка модель, модель координатор, а координатор — роутер и вот он ретеней сайкл. Неожиданное правило, легко можно протестировать, топчик!

```swift
@Test()
func inRouters_navigationStackController_shouldBeWeak() {
    let classes = Harmonize.productionCode()
        .classes().withNameContaining("Router")

    let stackControllers = classes
        .variables().withType(NavigationStackController.self)

    stackControllers.assertTrue(message: "delegates should be weak or unowned") { stackController in
        stackController.hasModifier(.weak)
        || stackController.hasModifier(.unowned)
    }
}
```

Можно в целом на описание классов. Например, не хочу использовать ObservedObject и целиком перейти на Perception. Пожалуйста, вот чек анотаций. Так же можно проверять, что MainActor у всех моделей есть.

```swift
@Test()
func allViewModels_shouldBePerceptible() {
    let viewModel = Harmonize.productionCode()
        .classes().withSuffix("ViewModel")

    viewModel.assertTrue { viewModel in
        viewModel.attributes.contains { attribute in
            attribute.name == "Perceptible"
        }
    }
}
```

Результаты теста влияют и на код, вот справа ошибка висит. Но в функциях указывает только на их название, поэтому не очень точно.

@Image(source: ErrorInCode, alt: nil) {
    Ошибки показываются как в тесте так и в коде
}

Увы, главное — обработка захвата self показывает либо чушь (что Task не захватил, ну камон) либо невозможно докопаться до нужного кода. Например, у меня есть 3 функции,  которые захватывают функцию в классе, две из них с утечками, я не смог написать тест ни на один кейс. Если вдруг кто-то знает как это сделать — дайте знать

@Image(source: ImpossibleSamples, alt: "Пример кода с тремя способами захвата self") {
    Self можно захватить тремя способами: пропустив слабую ссылку, указав слабую связь и передать функцию (т.е. тоже забыть передать слабую ссылку)
}

> Note: Фреймворк клевый, но у него есть ограниченная область применения. Отлично подходит как линтер и смотрит на то как вы описали сущности, но я не смог дотянуться до того как вы их вызываете. Синтаксис клевый, опять же. Я в проекте оставил, будут постепенно дополнять правилами. 

### References
- [Harmonize on Github](https://github.com/perrystreetsoftware/Harmonize)
- [Goodbye Code Reviews, Hello Harmonize: Enforce Your Architecture in Swift](https://itnext.io/goodbye-code-reviews-hello-harmonize-0a49e2872b5a)
- [3 essential tips for modern Swift linting](https://medium.com/perry-street-software-engineering/3-essential-tips-for-modern-swift-linting-9f4c23971294) с рекомендациями и другими примерами.

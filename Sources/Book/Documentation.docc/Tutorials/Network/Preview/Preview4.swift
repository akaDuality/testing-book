import Transactions
import API

@available(iOS 16.0, *)
#Preview("All cards") {
    CardSelectorScreen(viewModel: withDependencies({ deps in
        deps.api = APIStub()
            .success(CardsAPI.cards(),
                     [.testPhysical(), .testVirtual(status: .active)])
    }, operation: {
        CardSelectorViewModel(cardsRepository: CardsRepository())
    }))
}

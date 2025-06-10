import Transactions
import API

@available(iOS 16.0, *)
#Preview("All cards") {
    let viewModel = withDependencies({ deps in
        deps.api = APIStub()
            .success(CardsAPI.cards(), [.testPhysical(), .testVirtual()])
    }, operation: {
        CardSelectorViewModel(cardsRepository: CardsRepository())
    })
    
    CardSelectorScreen(viewModel: viewModel)
}

import Transactions
import API

@available(iOS 16.0, *)
#Preview("All cards", dependencies { deps in
    deps.api = APIStub()
        .success(CardsAPI.cards(), [.testPhysical(), .testVirtual()])
}) {
    let viewModel = CardSelectorViewModel(cardsRepository: CardsRepository())
    
    CardSelectorScreen(viewModel: viewModel)
}

import Transactions
import API

@available(iOS 16.0, *)
#Preview("All cards") {
    let api = APIStub()
        .success(CardsAPI.cards(), [.testPhysical(), .testVirtual()])
    
    let viewModel = CardSelectorViewModel(
        api: api,
        cardsRepository: CardsRepository()
    )
    
    CardSelectorScreen(viewModel: viewModel)
}

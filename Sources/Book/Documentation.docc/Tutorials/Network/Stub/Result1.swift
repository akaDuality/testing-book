@Test(.dependencies { deps in
    deps.api = APIStub.builder()
        .success(CardsAPI.issueCard(type: .physical), .testPhysical(status: .awaiting_activation))
        .success(CardsAPI.cards(), [.testPhysical(status: .awaiting_activation)], removeAfterExecution: true)
        .success(CardsAPI.activate(id: "123"))
        .success(CardsAPI.cards(), [.testPhysical(status: .active)])
        .build()
})
func whenOrderAndActivatePhysicalCard_shouldShowAndHideDeliveryTracking() async throws {
    let sut = CardsRepository()
    
    try await sut.orderPhysicalCard()
    try await sut.activate(cardId: "123")
    
    #expect(sut.deliveryViewModel.waitingDelivery == false)
}

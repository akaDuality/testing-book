@Suite
class GameTests {
    let sut = Game()
    
    @Test
    func tenFromTwoRollsShouldDoubleNextRoll() {
        spare(2) // Arrange
        
        roll(2) // Act
        
        expectScore(10 + 2*2) // Assert
    }
    
    // MARK: DSL
    func roll(_ pins: Int) {
        sut.roll(pins)
    }
    
    func spare(_ pins: Int) {
        sut.spare(pins)
    }
    
    func expectScore(
        _ score: Int,
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        sut.expectScore(score, sourceLocation: sourceLocation)
    }
}

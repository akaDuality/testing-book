@Suite
class GameTests {
    let sut = Game()
    
    @Test
    func tenFromTwoRollsShouldDoubleNextRoll() {
        sut.spare(2) // Arrange
        
        sut.roll(2) // Act
        
        sut.expectScore(10 + 2*2) // Assert
    }
}

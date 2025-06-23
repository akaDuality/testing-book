@Suite
class GameTests {
    let sut = Game()
    
    @Test
    func initialScore() {
        sut.expectScore(0)
    }
    
    @Test
    func rollOnePin() {
        sut.roll(1)
        
        sut.expectScore(1)
    }
    
    @Test
    func rollTwoTimes() {
        sut.roll(1)
        sut.roll(1)
        
        sut.expectScore(2)
    }
    
    @Test
    func max10FromSumOfTwoRolls() {
        sut.roll(9)
        sut.roll(9)
        
        sut.expectScore(10)
    }
    
    @Test
    func tenFromTwoRollsShouldDoubleNextRoll() {
        sut.spare(2) // Arrange
        
        sut.roll(2) // Act
        
        sut.expectScore(10 + 2*2) // Assert
    }
}

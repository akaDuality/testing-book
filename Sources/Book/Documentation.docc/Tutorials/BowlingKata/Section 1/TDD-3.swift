import Testing

@Suite
class GameTests {
    @Test
    func initialScore() {
        let sut = Game()
        
        #expect(sut.score == 0)
    }
    
    @Test
    func rollOnePin() {
        let sut = Game() // Arrange
        
        sut.roll(1) // Act
        
        #expect(sut.score == 1) // Assert
    }
    
    @Test
    func rollTwoTimes() {
        let sut = Game()
        
        sut.roll(1)
        sut.roll(1)
        
        #expect(sut.score == 2)
    }
}

class Game {
    private(set) var score = 0  
    
    func roll(_ pins: Int) {
        score += pins
    }
}

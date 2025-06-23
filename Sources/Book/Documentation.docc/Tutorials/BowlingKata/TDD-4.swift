import Testing

@Suite
class GameTests {
    @Test
    func initialScore() {
        let sut = Game()
        
        sut.expectScore(0)
    }
    
    @Test
    func rollOnePin() {
        let sut = Game() // Arrange
        
        sut.roll(1) // Act
        
        sut.expectScore(1) // Assert
    }
    
    @Test
    func rollTwoTimes() {
        let sut = Game()
        
        sut.roll(1)
        sut.roll(1)
        
        sut.expectScore(2)
    }
}

extension Game {
    func expectScore(
        _ expectedScore: Int
    ) {
        #expect(self.score == expectedScore)
    }
}

class Game {
    var score = 0
    
    func roll(_ pins: Int) {
        score += pins
    }
}



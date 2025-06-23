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
}

class Game {
    let score = 0
}

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
        let sut = Game()
        sut.roll(1)
        
        #expect(sut.score == 1)
    }
}

class Game {
    let score = 0
}

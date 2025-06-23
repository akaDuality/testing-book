import Testing

@Suite
class GameTests {
    @Test
    func initialScore() {
        let sut = Game()
        
        #expect(sut.score == 0)
    }
}

class Game {
    let score = 0
}

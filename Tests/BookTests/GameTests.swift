import Testing

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
}

extension Game {
    func expectScore(
        _ expectedScore: Int,
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        #expect(self.score == expectedScore, sourceLocation: sourceLocation)
    }
}

class Game {
    private(set) var score = 0
    private var rolls: [Int] = []
    
    func roll(_ pins: Int) {
        let pins = validatePotentialRoll(pins)
        rolls.append(pins)
        score = rolls.reduce(0, +)
    }
    
    private func validatePotentialRoll(_ pins: Int) -> Int {
        guard pins <= 10 else {
            return 10
        }
        
        guard pins >= 0 else {
            return 0
        }
        
        guard rolls.count > 0 else {
            return pins
        }
        
        let isSecondInFrame = rolls.count % 1 == 0
        if isSecondInFrame {
            return min(pins, 10 - rolls.last!)
        }
        
        return pins
    }
}

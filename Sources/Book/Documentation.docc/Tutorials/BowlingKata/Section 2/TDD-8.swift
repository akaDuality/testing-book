class Game {
    private(set) var score = 0
    private var rolls: [Int] = []
    
    func roll(_ pins: Int) {
        let pins = validatePotentialRoll(pins)
        rolls.append(pins)
        score = rolls.reduce(0, +)
    }
    
    private func validatePotentialRoll(_ pins: Int) -> Int {
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

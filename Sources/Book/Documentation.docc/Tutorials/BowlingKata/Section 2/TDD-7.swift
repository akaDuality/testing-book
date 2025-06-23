class Game {
    private(set) var score = 0    
    private var rolls: [Int] = []
    
    func roll(_ pins: Int) {
        rolls.append(pins)
        score = rolls.reduce(0, +)
    }
}

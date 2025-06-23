@Test
func maxScore() {
    sut.roll(10, times: 12)
    
    sut.expectScore(300)
}

extension Game {
    func roll(_ pins: Int, times: Int) {
        for _ in 0..<times {
            roll(pins)
        }
    }
}

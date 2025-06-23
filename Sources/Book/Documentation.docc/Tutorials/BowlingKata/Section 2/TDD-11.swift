@Test
func tenFromTwoRollsShouldDoubleNextRoll() {
    let sut = Game()
    sut.spare(2)
    
    sut.roll(2)
    
    sut.expectScore(10 + 2*2)
}

extension Game {
    func spare(_ firstRoll: Int) {
        roll(firstRoll)
        roll(10 - firstRoll)
    }
}

@Test
func strikeShouldDoubleNextTwoRolls() {
    sut.strike()
    
    sut.roll(2)
    sut.roll(3)
    
    sut.expectScore(10 + (2*2 + 3*3))
}

extension Game {
    func strike() {
        roll(10)
    }
}

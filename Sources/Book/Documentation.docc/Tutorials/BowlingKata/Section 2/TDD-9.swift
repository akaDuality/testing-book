@Test
func tenFromTwoRollsShouldDoubleNextRoll() {
    let sut = Game()
    
    sut.roll(2)
    sut.roll(8)
    sut.roll(2)
    
    sut.expectScore(14)
}

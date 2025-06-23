@Test
func max10FromSumOfTwoRolls() {
    let sut = Game()
    
    sut.roll(9)
    sut.roll(9)
    
    sut.expectScore(10)
}

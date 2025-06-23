@Test
func maxScore() {
    for _ in 0..<12 {
        sut.strike()
    }
    
    sut.expectScore(300)
}

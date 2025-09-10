let api = APIStub()
api.success(Auth.sendSMS(to: "+44 12 1234 1244"), .testMake())
api.fail(Auth.verify("+44 12 1234 1244", "1234"), removeAfterExecution: true)
api.success(Auth.verify("+44 12 1234 1244", "1234"), .testMake())

class APIStub {
    @discardableResult
    public func success<T: ResponseDTO>(
        _ request: Request<T>, _ response: T,
        numberOfCalls: Int = 1
    ) -> Self {

    }
    
    @discardableResult
    public func fail<T: ResponseDTO>(
        _ request: Request<T>,
        numberOfCalls: Int = 1
    ) -> Self {

    }
}

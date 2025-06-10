let api = APIStub()
api.success(Auth.sendSMS(to: "+44 12 1234 1244"), .testMake())
api.success(Auth.verify("+44 12 1234 1244", "1234"), .testMake())

public protocol APIProtocol: Actor {
    func send<T: Decodable>(
        _ request: Request<T>
    ) async throws -> T where T: Sendable
}

class APIStub {
    func success<T: ResponseDTO>(
        _ request: Request<T>, _ response: T,
        removeAfterExecution: Bool = false
    ) -> Self
        
    func fail<T: ResponseDTO>(
        _ request: Request<T>,
        removeAfterExecution: Bool = false
    ) -> Self
}

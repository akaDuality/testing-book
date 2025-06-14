let api = APIStub()
api.success(Auth.sendSMS(to: "+44 12 1234 1244"), .testMake())
api.fail(Auth.verify("+44 12 1234 1244", "1234"), removeAfterExecution: true)
api.success(Auth.verify("+44 12 1234 1244", "1234"), .testMake())

class APIStub {
    @discardableResult
    public func success<T: ResponseDTO>(
        _ request: Request<T>, _ response: T,
        removeAfterExecution: Bool = false
    ) -> Self {

    }
    
    @discardableResult
    public func fail<T: ResponseDTO>(
        _ request: Request<T>,
        removeAfterExecution: Bool = false
    ) -> Self {

    }
    
    var jsonResponses: [RequestDescriptor]
    
    public struct RequestDescriptor: Equatable, Sendable {
        let url: URL
        let result: Result<Sendable, any Error>
        var removeAfterExecution: Bool
        
        public static func == (
            lhs: APIStub.RequestDescriptor,
            rhs: APIStub.RequestDescriptor
        ) -> Bool {
            lhs.url == rhs.url
        }
    }
}

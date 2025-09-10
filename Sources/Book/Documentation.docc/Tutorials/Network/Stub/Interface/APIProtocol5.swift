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
        let descriptor = RequestDescriptor(
            url: request.url!,
            result: .success(response),
            numberOfCalls: numberOfCalls)
        
        jsonResponses.append(descriptor)
        return self
    }
    
    @discardableResult
    public func fail<T: ResponseDTO>(
        _ request: Request<T>,
        numberOfCalls: Int = 1
    ) -> Self {
        let descriptor = RequestDescriptor(
            url: request.url!,
            result: .failure(StubError.explicitFailure),
            numberOfCalls: numberOfCalls)
        
        jsonResponses.append(descriptor)
        
        return self
    }
    
    var jsonResponses: [RequestDescriptor]
    
    public class RequestDescriptor: Equatable, @unchecked Sendable {
        let url: URL
        let result: Result<Sendable, any Error>
        var numberOfCalls: Int
        
        public static func == (
            lhs: APIStub.RequestDescriptor,
            rhs: APIStub.RequestDescriptor
        ) -> Bool {
            lhs.url == rhs.url
        }
    }
}

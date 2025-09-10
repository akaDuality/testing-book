public protocol APIProtocol: Actor {
    func send<T: Decodable>(
        _ request: Request<T>
    ) async throws -> T where T: Sendable
}

extension APIStub: APIProtocol {
    public func send<T>(
        _ request: Get.Request<T>
    ) async throws -> T where T : Decodable, T : Sendable {
        let jsonResponse = jsonResponses.first { descriptor in
            descriptor.url == request.url
        }
        
        if let jsonResponse {
            jsonResponse.numberOfCalls -= 1
            
            if jsonResponse.numberOfCalls == 0 {
                let index = jsonResponses.firstIndex(of: jsonResponse)!
                jsonResponses.remove(at: index)
            }
            
            BlackBox.log("Stub request", userInfo: ["response": jsonResponse])
            return try jsonResponse.result.get() as! T
        } else {
            fatalError()
        }
    }
}



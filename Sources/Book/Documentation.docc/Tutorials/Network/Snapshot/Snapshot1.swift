import API
import InlineSnapshotTesting

extension APIStub {
    
    @MainActor
    public func expectInlineSnapshot(
        syntaxDescriptor: InlineSnapshotSyntaxDescriptor = InlineSnapshotSyntaxDescriptor(),
        matches expected: (() -> String)? = nil,
        fileID: StaticString = #fileID,
        file filePath: StaticString = #filePath,
        function: StaticString = #function,
        line: UInt = #line,
        column: UInt = #column
    ) {
        assertInlineSnapshot(
            of: calledPaths,
            as: .network,
            record: nil, // Write true to rewrite all analytics
            syntaxDescriptor: syntaxDescriptor,
            matches: expected,
            fileID: fileID,
            file: filePath,
            line: line,
            column: column)
    }
}

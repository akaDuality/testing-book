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

import Foundation
@available(macOS 10.13, watchOS 4.0, tvOS 11.0, *)
extension Snapshotting where Value == [URL], Format == String {
    /// A snapshot strategy for comparing analytics events in a readable format.
    public static var network: Snapshotting {
        return SimplySnapshotting.lines.pullback { (urls: [URL]) in
            urls.map(\.absoluteString).joined(separator: "\n")
        }
    }
}

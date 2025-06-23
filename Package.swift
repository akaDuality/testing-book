// swift-tools-version: 6.1
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "AboutTesting",
    products: [
        .library(name: "Book", targets: [
            "Book"
        ])
    ],
    dependencies: [
        .package(url: "https://github.com/swiftlang/swift-docc-plugin", from: "1.4.4"),
    ],
    targets: [
        .target(name: "Book"),
        .testTarget(name: "BookTests")
    ]

)

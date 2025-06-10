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
    targets: [
        .target(name: "Book"),
    ]

)

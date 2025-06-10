extension PersonalDetails {
    static func testMake() -> Self {
        Self(name: "Homer Simpson",
             date_of_birth: "2001-05-22",
             residential_address: "51 Dysart Avenue, Kingston Upon Thames, KT2 5RA",
             phone_number: "+44...1",
             email: "homer@springfield.com",
             tax_residency: "UK",
             photo_url: URL(string: "...")!
        )
    }
}

extension MeAPI.Profile {
    public static func testMake() -> Self {
        Self(personal_details: .testMake(),
             current_ledger: .testMake(),
             rnpl_ledger: .testMake())
    }
}

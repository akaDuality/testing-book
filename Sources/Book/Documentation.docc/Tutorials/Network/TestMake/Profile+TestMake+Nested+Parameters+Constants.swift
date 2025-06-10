extension PersonalDetails {
    static func testMake(
        name: String = "Homer Simpson",
        email: String = "homer@springfield.com"
    ) -> Self {
        Self(name: name,
             date_of_birth: "2001-05-22",
             residential_address: "51 Dysart Avenue, Kingston Upon Thames, KT2 5RA",
             phone_number: "+44...1",
             email: email,
             tax_residency: "UK",
             photo_url: URL(string: "...")!
        )
    }
}

extension MeAPI.Profile {
    public static func testHomer(
        name: String = "Homer Simpson",
        email: String = "homer@springfield.com"
    ) -> Self {
        Self(personal_details: .testMake(name: name, email: email),
             current_ledger: .testMake(),
             rnpl_ledger: .testMake())
    }
    
    public static func testMarge(
        name: String = "Marge Simpson",
        email: String = "marge@springfield.com"
    ) -> Self {
        Self(personal_details: .testMake(name: name, email: email),
             current_ledger: .testMake(),
             rnpl_ledger: .testMake())
    }
}

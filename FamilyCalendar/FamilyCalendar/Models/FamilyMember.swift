import Foundation
import FirebaseFirestore

struct FamilyMember: Identifiable, Codable {
    var id: String
    var name: String
    var color: String
    var userId: String
    var familyId: String
    var role: String // owner/member
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case color
        case userId
        case familyId
        case role
    }
}

extension FamilyMember {
    static func from(_ document: QueryDocumentSnapshot) throws -> FamilyMember {
        try document.data(as: FamilyMember.self)
    }
} 
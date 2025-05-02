import Foundation
import FirebaseFirestore

struct FamilyMember: Identifiable, Codable {
    var id: String
    var name: String
    var color: String
    var userId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case color
        case userId
    }
}

extension FamilyMember {
    static func from(_ document: QueryDocumentSnapshot) throws -> FamilyMember {
        let data = document.data()
        
        return FamilyMember(
            id: document.documentID,
            name: data["name"] as? String ?? "",
            color: data["color"] as? String ?? "#000000",
            userId: data["userId"] as? String ?? ""
        )
    }
} 
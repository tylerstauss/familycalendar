import Foundation
import FirebaseFirestore

struct Family: Identifiable, Codable {
    var id: String
    var name: String
    var creatorId: String
    var members: [FamilyMember]
    var createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case creatorId
        case members
        case createdAt
    }
}

extension Family {
    static func from(_ document: QueryDocumentSnapshot) throws -> Family {
        try document.data(as: Family.self)
    }
    
    func toDictionary() -> [String: Any] {
        return [
            "id": id,
            "name": name,
            "creatorId": creatorId,
            "members": members.map { [
                "id": $0.id,
                "name": $0.name,
                "color": $0.color,
                "userId": $0.userId,
                "familyId": $0.familyId,
                "role": $0.role
            ]},
            "createdAt": Timestamp(date: createdAt)
        ]
    }
} 
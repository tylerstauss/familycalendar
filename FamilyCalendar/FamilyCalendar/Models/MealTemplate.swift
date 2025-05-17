import Foundation
import FirebaseFirestore

struct MealTemplate: Identifiable, Codable {
    var id: String
    var name: String
    var type: String
    var ingredients: [String]
    var notes: String?
    var familyId: String
    var createdBy: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case type
        case ingredients
        case notes
        case familyId
        case createdBy
    }
}

extension MealTemplate {
    static func from(_ document: QueryDocumentSnapshot) throws -> MealTemplate {
        try document.data(as: MealTemplate.self)
    }
} 
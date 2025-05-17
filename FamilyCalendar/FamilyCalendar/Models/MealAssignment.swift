import Foundation
import FirebaseFirestore

struct MealAssignment: Identifiable, Codable {
    var id: String
    var templateId: String
    var assigneeId: String
    var date: Date
    var time: Date
    var status: String // planned/completed
    var familyId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case templateId
        case assigneeId
        case date
        case time
        case status
        case familyId
    }
}

extension MealAssignment {
    static func from(_ document: QueryDocumentSnapshot) throws -> MealAssignment {
        try document.data(as: MealAssignment.self)
    }
} 
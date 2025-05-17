import Foundation
import FirebaseFirestore

struct Meal: Identifiable, Codable {
    var id: String
    var name: String
    var type: String
    var ingredients: [String]
    var notes: String?
    var assigneeId: String
    var userId: String
    var time: Date?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case type
        case ingredients
        case notes
        case assigneeId
        case userId
        case time
    }
}

struct MealPlan: Identifiable, Codable {
    var id: String
    var meals: [Meal]
    var date: Date
    var userId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case meals
        case date
        case userId
    }
}

extension Meal {
    static func from(_ document: QueryDocumentSnapshot) throws -> Meal {
        let data = document.data()
        
        return Meal(
            id: document.documentID,
            name: data["name"] as? String ?? "",
            type: data["type"] as? String ?? "Breakfast",
            ingredients: data["ingredients"] as? [String] ?? [],
            notes: data["notes"] as? String,
            assigneeId: data["assigneeId"] as? String ?? "",
            userId: data["userId"] as? String ?? "",
            time: (data["time"] as? Timestamp)?.dateValue()
        )
    }
}

extension MealPlan {
    static func from(_ document: QueryDocumentSnapshot) throws -> MealPlan {
        let data = document.data()
        
        return MealPlan(
            id: document.documentID,
            meals: data["meals"] as? [Meal] ?? [],
            date: (data["date"] as? Timestamp)?.dateValue() ?? Date(),
            userId: data["userId"] as? String ?? ""
        )
    }
} 
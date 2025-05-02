import Foundation
import FirebaseFirestore

struct Meal: Identifiable, Codable {
    var id: String
    var name: String
    var ingredients: [String]
    var userId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case ingredients
        case userId
    }
}

struct MealPlan: Codable {
    var breakfast: Meal?
    var lunch: Meal?
    var dinner: Meal?
    var date: Date
    var userId: String
    
    enum CodingKeys: String, CodingKey {
        case breakfast
        case lunch
        case dinner
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
            ingredients: data["ingredients"] as? [String] ?? [],
            userId: data["userId"] as? String ?? ""
        )
    }
} 
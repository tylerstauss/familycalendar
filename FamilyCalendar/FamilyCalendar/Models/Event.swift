import Foundation
import FirebaseFirestore

struct Event: Identifiable, Codable {
    var id: String
    var title: String
    var startTime: Date
    var endTime: Date
    var location: String?
    var notes: String?
    var assignee: String?
    var color: String
    var isGoogleEvent: Bool
    var userId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case startTime
        case endTime
        case location
        case notes
        case assignee
        case color
        case isGoogleEvent
        case userId
    }
}

extension Event {
    static func from(_ document: QueryDocumentSnapshot) throws -> Event {
        let data = document.data()
        
        return Event(
            id: document.documentID,
            title: data["title"] as? String ?? "",
            startTime: (data["startTime"] as? Timestamp)?.dateValue() ?? Date(),
            endTime: (data["endTime"] as? Timestamp)?.dateValue() ?? Date(),
            location: data["location"] as? String,
            notes: data["notes"] as? String,
            assignee: data["assignee"] as? String,
            color: data["color"] as? String ?? "#000000",
            isGoogleEvent: data["isGoogleEvent"] as? Bool ?? false,
            userId: data["userId"] as? String ?? ""
        )
    }
} 
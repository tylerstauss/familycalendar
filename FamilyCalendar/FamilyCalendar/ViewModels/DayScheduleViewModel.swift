import SwiftUI
import FirebaseFirestore
import FirebaseAuth
import Foundation

@MainActor
class DayScheduleViewModel: ObservableObject, @unchecked Sendable {
    @Published var familyMembers: [FamilyMember] = []
    @Published private var eventsByMember: [String: [Event]] = [:]
    @Published private var mealsByMember: [String: [MealAssignment]] = [:]
    
    func loadData(for date: Date, familyId: String) async {
        // Calculate date boundaries
        let startOfDay = Calendar.current.startOfDay(for: date)
        let endOfDay = Calendar.current.date(byAdding: .day, value: 1, to: startOfDay)!
        
        // Load family members
        let db = Firestore.firestore()
        do {
            let membersSnapshot = try await db.collection("families")
                .document(familyId)
                .collection("members")
                .getDocuments()
            
            self.familyMembers = membersSnapshot.documents.compactMap { doc -> FamilyMember? in
                try? doc.data(as: FamilyMember.self)
            }
            
            // Load events for each member
            for member in familyMembers {
                let eventsSnapshot = try await db.collection("families")
                    .document(familyId)
                    .collection("events")
                    .whereField("memberId", isEqualTo: member.id)
                    .whereField("startTime", isGreaterThanOrEqualTo: startOfDay)
                    .whereField("startTime", isLessThan: endOfDay)
                    .getDocuments()
                
                let events = eventsSnapshot.documents.compactMap { doc -> Event? in
                    try? doc.data(as: Event.self)
                }
                
                self.eventsByMember[member.id] = events
            }
            
            // Load meal assignments for each member
            for member in familyMembers {
                let mealsSnapshot = try await db.collection("families")
                    .document(familyId)
                    .collection("mealAssignments")
                    .whereField("memberId", isEqualTo: member.id)
                    .whereField("date", isEqualTo: startOfDay)
                    .getDocuments()
                
                let meals = mealsSnapshot.documents.compactMap { doc -> MealAssignment? in
                    try? doc.data(as: MealAssignment.self)
                }
                
                self.mealsByMember[member.id] = meals
            }
        } catch {
            print("Error loading schedule data: \(error)")
        }
    }
    
    func events(for memberId: String) -> [Event] {
        return eventsByMember[memberId] ?? []
    }
    
    func meals(for memberId: String) -> [MealAssignment] {
        return mealsByMember[memberId] ?? []
    }
} 
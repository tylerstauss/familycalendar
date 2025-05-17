import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class DayViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var mealAssignments: [MealAssignment] = []
    @Published var showingAddEvent = false
    
    private var db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    
    init() {
        loadTodayData()
    }
    
    func loadTodayData() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        
        // Load events
        listenerRegistration?.remove()
        listenerRegistration = db.collection("users/\(userId)/events")
            .whereField("startTime", isGreaterThanOrEqualTo: startOfDay)
            .whereField("startTime", isLessThan: endOfDay)
            .addSnapshotListener { [weak self] querySnapshot, error in
                guard let documents = querySnapshot?.documents else {
                    print("Error fetching documents: \(error?.localizedDescription ?? "Unknown error")")
                    return
                }
                
                Task { @MainActor in
                    self?.events = documents.compactMap { document in
                        try? Event.from(document)
                    }
                }
            }
    }
    
    func loadData(for date: Date, familyId: String) async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        
        // Load events
        listenerRegistration?.remove()
        listenerRegistration = db.collection("families/\(familyId)/events")
            .whereField("startTime", isGreaterThanOrEqualTo: startOfDay)
            .whereField("startTime", isLessThan: endOfDay)
            .addSnapshotListener { [weak self] querySnapshot, error in
                guard let documents = querySnapshot?.documents else {
                    print("Error fetching documents: \(error?.localizedDescription ?? "Unknown error")")
                    return
                }
                
                Task { @MainActor in
                    self?.events = documents.compactMap { document in
                        try? Event.from(document)
                    }
                }
            }
        
        // Load meal assignments
        let snapshot = try? await db.collection("families/\(familyId)/mealAssignments")
            .whereField("date", isGreaterThanOrEqualTo: Timestamp(date: startOfDay))
            .whereField("date", isLessThan: Timestamp(date: endOfDay))
            .getDocuments()
        
        if let documents = snapshot?.documents {
            self.mealAssignments = documents.compactMap { try? MealAssignment.from($0) }
        }
    }
    
    func events(for memberId: String) -> [Event] {
        return events.filter { $0.assignees.contains(memberId) }
    }
    
    func meals(for memberId: String) -> [MealAssignment] {
        return mealAssignments.filter { $0.assigneeId == memberId }
    }
    
    func template(for meal: MealAssignment) -> MealTemplate? {
        // TODO: Implement this method to fetch the meal template
        return nil
    }
    
    deinit {
        listenerRegistration?.remove()
    }
} 
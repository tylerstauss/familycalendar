import Foundation
import FirebaseFirestore
import FirebaseAuth

class WeekViewModel: ObservableObject {
    @Published var weekEvents: [Event] = []
    @Published var weekDays: [Date] = []
    @Published var showingAddEvent = false
    
    private var db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    private let calendar = Calendar.current
    
    init(initialDate: Date = Date()) {
        generateWeekDays(from: initialDate)
        // Load events for the week
        loadWeekData()
    }
    
    private func generateWeekDays(from date: Date) {
        let calendar = Calendar.current
        let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date))!
        weekDays = (0...6).map { day in
            calendar.date(byAdding: .day, value: day, to: startOfWeek)!
        }
    }
    
    func weekdayName(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }
    
    func dayNumber(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
    
    func loadWeekData() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let calendar = Calendar.current
        guard let startOfWeek = weekDays.first,
              let endOfWeek = calendar.date(byAdding: .day, value: 1, to: weekDays.last ?? Date()) else { return }
        
        listenerRegistration?.remove()
        listenerRegistration = db.collection("users/\(userId)/events")
            .whereField("startTime", isGreaterThanOrEqualTo: startOfWeek)
            .whereField("startTime", isLessThan: endOfWeek)
            .addSnapshotListener { [weak self] querySnapshot, error in
                guard let documents = querySnapshot?.documents else {
                    print("Error fetching documents: \(error?.localizedDescription ?? "Unknown error")")
                    return
                }
                
                self?.weekEvents = documents.compactMap { document in
                    try? Event.from(document)
                }
            }
    }
    
    deinit {
        listenerRegistration?.remove()
    }
} 
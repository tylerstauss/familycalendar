import Foundation
import FirebaseFirestore
import FirebaseAuth

class WeekViewModel: ObservableObject {
    @Published var weekEvents: [Event] = []
    @Published var weekDays: [Date] = []
    @Published var showingAddEvent = false
    
    private var db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    
    init() {
        setupWeekDays()
        loadWeekData()
    }
    
    private func setupWeekDays() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        
        // Get the start of the week (Sunday)
        var weekday = calendar.component(.weekday, from: today)
        let daysToSubtract = weekday - 1
        
        guard let startOfWeek = calendar.date(byAdding: .day, value: -daysToSubtract, to: today) else { return }
        
        // Generate array of dates for the week
        weekDays = (0...6).compactMap { day in
            calendar.date(byAdding: .day, value: day, to: startOfWeek)
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
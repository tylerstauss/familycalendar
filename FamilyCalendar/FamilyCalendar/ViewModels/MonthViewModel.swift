import Foundation
import FirebaseFirestore
import FirebaseAuth

class MonthViewModel: ObservableObject {
    @Published var monthEvents: [Event] = []
    @Published var currentDate = Date()
    @Published var showingAddEvent = false
    
    private var db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    
    let weekdaySymbols = Calendar.current.veryShortWeekdaySymbols
    
    var monthYearString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: currentDate)
    }
    
    var daysInMonth: [Date?] {
        let calendar = Calendar.current
        
        // Get start of the month
        let interval = calendar.dateInterval(of: .month, for: currentDate)!
        let firstDay = interval.start
        
        // Get the weekday of the first day (1 = Sunday, 7 = Saturday)
        let firstWeekday = calendar.component(.weekday, from: firstDay)
        
        // Calculate days in month
        let daysInMonth = calendar.range(of: .day, in: .month, for: currentDate)!.count
        
        // Create array with empty slots for days before the first day of month
        var days: [Date?] = Array(repeating: nil, count: firstWeekday - 1)
        
        // Add all days of the month
        for day in 1...daysInMonth {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: firstDay) {
                days.append(date)
            }
        }
        
        // Add empty slots to complete the last week if needed
        while days.count % 7 != 0 {
            days.append(nil)
        }
        
        return days
    }
    
    init() {
        loadMonthData()
    }
    
    func previousMonth() {
        guard let newDate = Calendar.current.date(byAdding: .month, value: -1, to: currentDate) else { return }
        currentDate = newDate
        loadMonthData()
    }
    
    func nextMonth() {
        guard let newDate = Calendar.current.date(byAdding: .month, value: 1, to: currentDate) else { return }
        currentDate = newDate
        loadMonthData()
    }
    
    func events(for date: Date) -> [Event] {
        let calendar = Calendar.current
        return monthEvents.filter { event in
            calendar.isDate(event.startTime, inSameDayAs: date)
        }
    }
    
    func loadMonthData() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let calendar = Calendar.current
        guard let interval = calendar.dateInterval(of: .month, for: currentDate),
              let endOfMonth = calendar.date(byAdding: .day, value: 1, to: interval.end) else { return }
        
        listenerRegistration?.remove()
        listenerRegistration = db.collection("users/\(userId)/events")
            .whereField("startTime", isGreaterThanOrEqualTo: interval.start)
            .whereField("startTime", isLessThan: endOfMonth)
            .addSnapshotListener { [weak self] querySnapshot, error in
                guard let documents = querySnapshot?.documents else {
                    print("Error fetching documents: \(error?.localizedDescription ?? "Unknown error")")
                    return
                }
                
                self?.monthEvents = documents.compactMap { document in
                    try? Event.from(document)
                }
            }
    }
    
    deinit {
        listenerRegistration?.remove()
    }
} 
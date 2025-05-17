import Foundation
import FirebaseFirestore
import FirebaseAuth

class MonthViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var currentDate: Date
    @Published var selectedDate: Date?
    @Published var showingAddEvent = false
    @Published var daysInMonth: [Date?] = []
    @Published var monthEvents: [Event] = []
    
    // MARK: - Private Properties
    private let calendar = Calendar.current
    let weekdaySymbols = Calendar.current.veryShortWeekdaySymbols
    private let db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    
    // MARK: - Computed Properties
    var monthYearString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: currentDate)
    }
    
    // MARK: - Initialization
    init(initialDate: Date = Date()) {
        self.currentDate = initialDate
        self.selectedDate = initialDate
        generateDaysInMonth()
        loadMonthData()
    }
    
    deinit {
        // Clean up listener when view model is deallocated
        listenerRegistration?.remove()
    }
    
    // MARK: - Public Methods
    func previousMonth() {
        guard let newDate = Calendar.current.date(byAdding: .month, value: -1, to: currentDate) else { return }
        currentDate = newDate
        generateDaysInMonth()
        loadMonthData()
    }
    
    func nextMonth() {
        guard let newDate = Calendar.current.date(byAdding: .month, value: 1, to: currentDate) else { return }
        currentDate = newDate
        generateDaysInMonth()
        loadMonthData()
    }
    
    func events(for date: Date) -> [Event] {
        let calendar = Calendar.current
        return monthEvents.filter { event in
            calendar.isDate(event.startTime, inSameDayAs: date)
        }
    }
    
    // MARK: - Private Methods
    private func generateDaysInMonth() {
        // Get the start of the month
        guard let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: currentDate)) else {
            return
        }
        
        // Get the range of days in the month
        guard let range = calendar.range(of: .day, in: .month, for: currentDate) else {
            return
        }
        
        // Get the weekday of the first day (1-7, 1 is Sunday)
        let firstWeekday = calendar.component(.weekday, from: startOfMonth)
        
        // Create array with empty slots for days before the first day of the month
        var days: [Date?] = Array(repeating: nil, count: firstWeekday - 1)
        
        // Add all days of the month
        for day in 1...range.count {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: startOfMonth) {
                days.append(date)
            }
        }
        
        // Add empty slots to complete the last week if needed
        let remainingDays = 42 - days.count // 6 weeks * 7 days = 42
        if remainingDays > 0 {
            days.append(contentsOf: Array(repeating: nil, count: remainingDays))
        }
        
        daysInMonth = days
    }
    
    private func loadMonthData() {
        // Remove existing listener if any
        listenerRegistration?.remove()
        
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let calendar = Calendar.current
        guard let interval = calendar.dateInterval(of: .month, for: currentDate),
              let endOfMonth = calendar.date(byAdding: .day, value: 1, to: interval.end) else { return }
        
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
} 
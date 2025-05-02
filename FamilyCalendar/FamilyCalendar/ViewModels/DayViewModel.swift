import Foundation
import FirebaseFirestore
import FirebaseAuth

class DayViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var meals: MealPlan = MealPlan(date: Date(), userId: "")
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
                
                self?.events = documents.compactMap { document in
                    try? Event.from(document)
                }
            }
        
        // Load meal plan
        db.collection("users/\(userId)/mealPlans")
            .whereField("date", isEqualTo: Timestamp(date: startOfDay))
            .getDocuments { [weak self] querySnapshot, error in
                guard let document = querySnapshot?.documents.first else {
                    // No meal plan for today
                    self?.meals = MealPlan(date: startOfDay, userId: userId)
                    return
                }
                
                let data = document.data()
                // Load meals from references
                if let breakfastRef = data["breakfast"] as? DocumentReference {
                    breakfastRef.getDocument { document, _ in
                        if let document = document {
                            self?.meals.breakfast = try? Meal.from(document as! QueryDocumentSnapshot)
                        }
                    }
                }
                
                if let lunchRef = data["lunch"] as? DocumentReference {
                    lunchRef.getDocument { document, _ in
                        if let document = document {
                            self?.meals.lunch = try? Meal.from(document as! QueryDocumentSnapshot)
                        }
                    }
                }
                
                if let dinnerRef = data["dinner"] as? DocumentReference {
                    dinnerRef.getDocument { document, _ in
                        if let document = document {
                            self?.meals.dinner = try? Meal.from(document as! QueryDocumentSnapshot)
                        }
                    }
                }
            }
    }
    
    deinit {
        listenerRegistration?.remove()
    }
} 
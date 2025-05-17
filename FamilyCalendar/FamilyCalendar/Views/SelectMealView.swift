import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct SelectMealView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: SelectMealViewModel
    let date: Date
    let mealType: String
    let onAssign: () -> Void
    
    init(date: Date, mealType: String, onAssign: @escaping () -> Void) {
        let defaultTime = SelectMealViewModel.defaultTime(for: mealType, on: date)
        _viewModel = StateObject(wrappedValue: SelectMealViewModel(selectedTime: defaultTime))
        self.date = date
        self.mealType = mealType
        self.onAssign = onAssign
    }
    
    var body: some View {
        NavigationView {
            List {
                Section("Time") {
                    DatePicker("Time", selection: $viewModel.selectedTime, displayedComponents: .hourAndMinute)
                }
                
                Section("Family Members") {
                    if viewModel.isLoadingMembers {
                        ProgressView()
                    } else {
                        ForEach(viewModel.familyMembers) { member in
                            HStack {
                                Circle()
                                    .fill(Color(hex: member.color))
                                    .frame(width: 20, height: 20)
                                Text(member.name)
                                Spacer()
                                if viewModel.selectedMemberIds.contains(member.id) {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.toggleMember(member.id)
                            }
                        }
                    }
                }
                
                Section("Select Meal") {
                    if viewModel.isLoadingMeals {
                        ProgressView()
                    } else {
                        ForEach(viewModel.meals) { meal in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(meal.name)
                                        .font(.headline)
                                    if !meal.ingredients.isEmpty {
                                        Text("\(meal.ingredients.count) ingredients")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                Spacer()
                                if viewModel.selectedMealId == meal.id {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.selectedMealId = meal.id
                            }
                        }
                    }
                }
            }
            .navigationTitle("Select \(mealType)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Assign") {
                        Task {
                            await viewModel.assignMeal(type: mealType, for: date)
                            onAssign()
                            dismiss()
                        }
                    }
                    .disabled(!viewModel.isValid)
                }
            }
            .alert("Error", isPresented: $viewModel.showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage)
            }
            .task {
                await viewModel.loadData()
            }
        }
    }
}

class SelectMealViewModel: ObservableObject {
    @Published var selectedMemberIds: Set<String> = []
    @Published var selectedMealId: String?
    @Published var selectedTime: Date
    @Published var familyMembers: [FamilyMember] = []
    @Published var meals: [Meal] = []
    @Published var isLoadingMembers = false
    @Published var isLoadingMeals = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    
    init(selectedTime: Date) {
        self.selectedTime = selectedTime
    }
    
    var isValid: Bool {
        !selectedMemberIds.isEmpty && selectedMealId != nil
    }
    
    static func defaultTime(for mealType: String, on date: Date) -> Date {
        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month, .day], from: date)
        
        // Set default times in PST
        let timeZone = TimeZone(identifier: "America/Los_Angeles")!
        components.timeZone = timeZone
        
        switch mealType {
        case "Breakfast":
            components.hour = 8
            components.minute = 0
        case "Lunch":
            components.hour = 12
            components.minute = 30
        case "Dinner":
            components.hour = 18
            components.minute = 30
        default: // Snack or any other meal type
            let currentHour = calendar.component(.hour, from: date)
            components.hour = currentHour
            components.minute = 0
        }
        
        return calendar.date(from: components) ?? date
    }
    
    func toggleMember(_ memberId: String) {
        if selectedMemberIds.contains(memberId) {
            selectedMemberIds.remove(memberId)
        } else {
            selectedMemberIds.insert(memberId)
        }
    }
    
    @MainActor
    func loadData() async {
        await loadFamilyMembers()
        await loadMeals()
    }
    
    @MainActor
    private func loadFamilyMembers() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        isLoadingMembers = true
        defer { isLoadingMembers = false }
        
        do {
            let snapshot = try await db.collection("users/\(userId)/familyMembers").getDocuments()
            familyMembers = snapshot.documents.compactMap { try? $0.data(as: FamilyMember.self) }
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
    
    @MainActor
    private func loadMeals() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        isLoadingMeals = true
        defer { isLoadingMeals = false }
        
        do {
            let snapshot = try await db.collection("users/\(userId)/meals").getDocuments()
            meals = snapshot.documents.compactMap { try? $0.data(as: Meal.self) }
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
    
    @MainActor
    func assignMeal(type: String, for date: Date) async {
        guard let userId = Auth.auth().currentUser?.uid,
              let selectedMeal = meals.first(where: { $0.id == selectedMealId }) else {
            print("❌ Failed to assign meal: userId or selectedMeal not found")
            return
        }
        
        print("📝 Starting meal assignment for user: \(userId)")
        print("👥 Selected member IDs: \(selectedMemberIds)")
        
        // Get the selected time components
        let calendar = Calendar.current
        let mealTime = calendar.date(bySettingHour: calendar.component(.hour, from: selectedTime),
                                   minute: calendar.component(.minute, from: selectedTime),
                                   second: 0,
                                   of: date) ?? date
        
        // Create a meal for each selected family member
        let meals = selectedMemberIds.map { memberId in
            Meal(
                id: UUID().uuidString,
                name: selectedMeal.name,
                type: type,
                ingredients: selectedMeal.ingredients,
                notes: selectedMeal.notes,
                assigneeId: memberId,
                userId: userId,
                time: mealTime
            )
        }
        
        print("🍽 Created \(meals.count) meal assignments")
        
        // Get the start of the day for the selected date
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        
        do {
            print("🔍 Searching for existing meal plan on \(startOfDay)")
            // Try to find an existing meal plan for this date
            let mealPlansRef = db.collection("users/\(userId)/mealPlans")
            let querySnapshot = try await mealPlansRef
                .whereField("date", isGreaterThanOrEqualTo: Timestamp(date: startOfDay))
                .whereField("date", isLessThan: Timestamp(date: endOfDay))
                .getDocuments()
            
            if let existingPlan = querySnapshot.documents.first {
                print("📋 Found existing meal plan, updating...")
                // Update existing meal plan
                var mealPlan = try existingPlan.data(as: MealPlan.self)
                mealPlan.meals.append(contentsOf: meals)
                try await mealPlansRef.document(mealPlan.id).setData(from: mealPlan)
                print("✅ Successfully updated existing meal plan")
            } else {
                print("📝 No existing meal plan found, creating new one...")
                // Create new meal plan
                let mealPlan = MealPlan(
                    id: UUID().uuidString,
                    meals: meals,
                    date: startOfDay, // Keep the date as start of day for the meal plan
                    userId: userId
                )
                try await mealPlansRef.document(mealPlan.id).setData(from: mealPlan)
                print("✅ Successfully created new meal plan")
            }
        } catch {
            print("❌ Error saving meal plan: \(error.localizedDescription)")
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
} 
import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct AddMealView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AddMealViewModel()
    
    let date: Date
    
    private let mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"]
    @State private var newIngredient = ""
    
    var body: some View {
        NavigationView {
            Form {
                Section("Meal Details") {
                    Picker("Type", selection: $viewModel.mealType) {
                        ForEach(mealTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    
                    TextField("Name", text: $viewModel.name)
                    TextField("Notes", text: $viewModel.notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                
                Section("Ingredients") {
                    ForEach(viewModel.ingredients, id: \.self) { ingredient in
                        Text(ingredient)
                    }
                    .onDelete { indices in
                        viewModel.ingredients.remove(atOffsets: indices)
                    }
                    
                    HStack {
                        TextField("Add ingredient", text: $newIngredient)
                        Button("Add") {
                            if !newIngredient.isEmpty {
                                viewModel.ingredients.append(newIngredient)
                                newIngredient = ""
                            }
                        }
                    }
                }
                
                Section("Assignment") {
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
                                if viewModel.selectedMemberId == member.id {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.selectedMemberId = member.id
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add Meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await viewModel.saveMeal(for: date)
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
                await viewModel.loadFamilyMembers()
            }
        }
    }
}

class AddMealViewModel: ObservableObject {
    @Published var mealType = "Breakfast"
    @Published var name = ""
    @Published var notes = ""
    @Published var ingredients: [String] = []
    @Published var selectedMemberId: String?
    @Published var familyMembers: [FamilyMember] = []
    @Published var isLoadingMembers = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    
    var isValid: Bool {
        !name.isEmpty && selectedMemberId != nil
    }
    
    @MainActor
    func loadFamilyMembers() async {
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
    func saveMeal(for date: Date) async {
        guard let userId = Auth.auth().currentUser?.uid,
              let memberId = selectedMemberId else { return }
        
        // Create the meal
        let meal = Meal(
            id: UUID().uuidString,
            name: name,
            type: mealType,
            ingredients: ingredients,
            notes: notes.isEmpty ? nil : notes,
            assigneeId: memberId,
            userId: userId
        )
        
        do {
            // Get the start and end of the day for the given date
            let calendar = Calendar.current
            let startOfDay = calendar.startOfDay(for: date)
            let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
            
            // Try to find an existing meal plan for this date
            let mealPlansRef = db.collection("users/\(userId)/mealPlans")
            let querySnapshot = try await mealPlansRef
                .whereField("date", isGreaterThanOrEqualTo: Timestamp(date: startOfDay))
                .whereField("date", isLessThan: Timestamp(date: endOfDay))
                .getDocuments()
            
            if let existingPlan = querySnapshot.documents.first {
                // Update existing meal plan
                var mealPlan = try existingPlan.data(as: MealPlan.self)
                mealPlan.meals.append(meal)
                try await mealPlansRef.document(mealPlan.id).setData(from: mealPlan)
            } else {
                // Create new meal plan
                let mealPlan = MealPlan(
                    id: UUID().uuidString,
                    meals: [meal],
                    date: startOfDay,
                    userId: userId
                )
                try await mealPlansRef.document(mealPlan.id).setData(from: mealPlan)
            }
            
            // Also save the meal in the meals collection for reference
            try await db.collection("users/\(userId)/meals").document(meal.id).setData(from: meal)
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    AddMealView(date: Date())
} 
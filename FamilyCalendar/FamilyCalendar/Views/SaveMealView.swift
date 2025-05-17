import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct SaveMealView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SaveMealViewModel()
    @State private var newIngredient = ""
    
    private let mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"]
    
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
            }
            .navigationTitle("Save Meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await viewModel.saveMeal()
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
        }
    }
}

class SaveMealViewModel: ObservableObject {
    @Published var mealType = "Breakfast"
    @Published var name = ""
    @Published var notes = ""
    @Published var ingredients: [String] = []
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    
    var isValid: Bool {
        !name.isEmpty && !ingredients.isEmpty
    }
    
    @MainActor
    func saveMeal() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let meal = Meal(
            id: UUID().uuidString,
            name: name,
            type: mealType,
            ingredients: ingredients,
            notes: notes.isEmpty ? nil : notes,
            assigneeId: "",  // Will be set when assigned to a day
            userId: userId
        )
        
        do {
            try await db.collection("users/\(userId)/meals").document(meal.id).setData(from: meal)
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
} 
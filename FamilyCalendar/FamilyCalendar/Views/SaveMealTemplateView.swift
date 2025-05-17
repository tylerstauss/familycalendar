import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct SaveMealTemplateView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var familyViewModel: FamilyViewModel
    @StateObject private var viewModel = SaveMealTemplateViewModel()
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
            .navigationTitle("New Meal Template")
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
                            await viewModel.saveMealTemplate(familyId: familyViewModel.currentFamily?.id ?? "")
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

class SaveMealTemplateViewModel: ObservableObject {
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
    func saveMealTemplate(familyId: String) async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let template = MealTemplate(
            id: UUID().uuidString,
            name: name,
            type: mealType,
            ingredients: ingredients,
            notes: notes.isEmpty ? nil : notes,
            familyId: familyId,
            createdBy: userId
        )
        
        do {
            try await db.collection("families/\(familyId)/mealTemplates")
                .document(template.id)
                .setData(from: template)
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
} 
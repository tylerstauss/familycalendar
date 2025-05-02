import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct AddMealView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AddMealViewModel()
    
    let date: Date
    
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
        
        let meal = Meal(
            id: UUID().uuidString,
            type: mealType,
            name: name,
            notes: notes,
            date: date,
            userId: userId,
            assignedTo: memberId
        )
        
        do {
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
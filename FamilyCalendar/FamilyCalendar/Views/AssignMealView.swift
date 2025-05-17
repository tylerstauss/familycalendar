import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct AssignMealView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var familyViewModel: FamilyViewModel
    @StateObject private var viewModel: AssignMealViewModel
    @State private var selectedDate = Date()
    @State private var selectedTime = Date()
    
    init(template: MealTemplate) {
        _viewModel = StateObject(wrappedValue: AssignMealViewModel(template: template))
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section("Date & Time") {
                    DatePicker("Date", selection: $selectedDate, displayedComponents: .date)
                    DatePicker("Time", selection: $selectedTime, displayedComponents: .hourAndMinute)
                }
                
                Section("Assignment") {
                    if viewModel.isLoadingMembers {
                        ProgressView()
                    } else {
                        ForEach(familyViewModel.familyMembers) { member in
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
            }
            .navigationTitle("Assign Meal")
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
                            await viewModel.assignMeal(
                                date: selectedDate,
                                time: selectedTime,
                                familyId: familyViewModel.currentFamily?.id ?? ""
                            )
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

class AssignMealViewModel: ObservableObject {
    @Published var selectedMemberIds: Set<String> = []
    @Published var isLoadingMembers = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private let template: MealTemplate
    private var db = Firestore.firestore()
    
    init(template: MealTemplate) {
        self.template = template
    }
    
    var isValid: Bool {
        !selectedMemberIds.isEmpty
    }
    
    func toggleMember(_ memberId: String) {
        if selectedMemberIds.contains(memberId) {
            selectedMemberIds.remove(memberId)
        } else {
            selectedMemberIds.insert(memberId)
        }
    }
    
    @MainActor
    func assignMeal(date: Date, time: Date, familyId: String) async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        // Create a meal assignment for each selected family member
        let assignments = selectedMemberIds.map { memberId in
            MealAssignment(
                id: UUID().uuidString,
                templateId: template.id,
                assigneeId: memberId,
                date: date,
                time: time,
                status: "planned",
                familyId: familyId
            )
        }
        
        do {
            // Save each assignment
            for assignment in assignments {
                try await db.collection("families/\(familyId)/mealAssignments")
                    .document(assignment.id)
                    .setData(from: assignment)
            }
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
} 
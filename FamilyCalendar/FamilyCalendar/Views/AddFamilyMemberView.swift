import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct AddFamilyMemberView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AddFamilyMemberViewModel()
    
    private let colors: [(name: String, hex: String)] = [
        ("Red", "#FF0000"),
        ("Blue", "#0000FF"),
        ("Green", "#00FF00"),
        ("Yellow", "#FFFF00"),
        ("Purple", "#800080"),
        ("Orange", "#FFA500"),
        ("Pink", "#FFC0CB"),
        ("Cyan", "#00FFFF")
    ]
    
    var body: some View {
        NavigationView {
            Form {
                Section("Member Details") {
                    TextField("Name", text: $viewModel.name)
                }
                
                Section("Color") {
                    ForEach(colors, id: \.hex) { color in
                        HStack {
                            Circle()
                                .fill(Color(hex: color.hex))
                                .frame(width: 20, height: 20)
                            Text(color.name)
                            Spacer()
                            if viewModel.selectedColor == color.hex {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.blue)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            viewModel.selectedColor = color.hex
                        }
                    }
                }
            }
            .navigationTitle("Add Family Member")
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
                            await viewModel.saveMember()
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

class AddFamilyMemberViewModel: ObservableObject {
    @Published var name = ""
    @Published var selectedColor = "#FF0000"  // Default to red
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    
    var isValid: Bool {
        !name.isEmpty
    }
    
    @MainActor
    func saveMember() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let member = FamilyMember(
            id: UUID().uuidString,
            name: name,
            color: selectedColor,
            userId: userId
        )
        
        do {
            try await db.collection("users/\(userId)/familyMembers").document(member.id).setData(from: member)
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    AddFamilyMemberView()
} 
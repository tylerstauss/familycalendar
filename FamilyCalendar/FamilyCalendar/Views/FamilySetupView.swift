import SwiftUI
import FirebaseAuth

struct FamilySetupView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = FamilyViewModel()
    @State private var familyName = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            Form {
                Section("Family Details") {
                    TextField("Family Name", text: $familyName)
                }
                
                Section {
                    Button("Create Family") {
                        Task {
                            await createFamily()
                        }
                    }
                    .disabled(familyName.isEmpty)
                }
            }
            .navigationTitle("Welcome!")
            .navigationBarTitleDisplayMode(.large)
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
        }
    }
    
    private func createFamily() async {
        do {
            await viewModel.createFamily(name: familyName)
            dismiss()
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    FamilySetupView()
} 
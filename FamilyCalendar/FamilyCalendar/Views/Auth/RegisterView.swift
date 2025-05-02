import SwiftUI
import FirebaseAuth
import FirebaseFirestore

struct RegisterView: View {
    @StateObject private var viewModel = RegisterViewModel()
    @Binding var isAuthenticated: Bool
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        Form {
            Section {
                TextField("Display Name", text: $viewModel.displayName)
                    .textContentType(.name)
                
                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                
                SecureField("Password", text: $viewModel.password)
                    .textContentType(.newPassword)
                
                SecureField("Confirm Password", text: $viewModel.confirmPassword)
                    .textContentType(.newPassword)
            }
            
            Section {
                Button(action: {
                    Task {
                        await viewModel.register()
                    }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle())
                    } else {
                        Text("Create Account")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(!viewModel.isValid || viewModel.isLoading)
                
                Button("Already have an account?") {
                    dismiss()
                }
                .foregroundColor(.secondary)
            }
        }
        .navigationTitle("Register")
        .alert("Error", isPresented: $viewModel.showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onChange(of: viewModel.isAuthenticated) { newValue in
            isAuthenticated = newValue
        }
    }
}

class RegisterViewModel: ObservableObject {
    @Published var displayName = ""
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var isLoading = false
    @Published var showingError = false
    @Published var errorMessage = ""
    @Published var isAuthenticated = false
    
    private var db = Firestore.firestore()
    
    var isValid: Bool {
        !displayName.isEmpty &&
        !email.isEmpty &&
        !password.isEmpty &&
        !confirmPassword.isEmpty &&
        email.contains("@") &&
        password.count >= 6 &&
        password == confirmPassword
    }
    
    @MainActor
    func register() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let result = try await Auth.auth().createUser(withEmail: email, password: password)
            
            // Create user profile in Firestore
            try await db.collection("users").document(result.user.uid).setData([
                "displayName": displayName,
                "email": email,
                "googleCalendarLinked": false,
                "createdAt": Timestamp()
            ])
            
            isAuthenticated = true
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationView {
        RegisterView(isAuthenticated: .constant(false))
    }
} 
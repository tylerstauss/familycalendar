import SwiftUI
import FirebaseAuth

struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
    @Binding var isAuthenticated: Bool
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Email", text: $viewModel.email)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                    
                    SecureField("Password", text: $viewModel.password)
                        .textContentType(.password)
                }
                
                Section {
                    Button(action: {
                        Task {
                            await viewModel.login()
                        }
                    }) {
                        if viewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                        } else {
                            Text("Login")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(!viewModel.isValid || viewModel.isLoading)
                    
                    NavigationLink("Create Account", destination: RegisterView(isAuthenticated: $isAuthenticated))
                }
            }
            .navigationTitle("Login")
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
}

class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var showingError = false
    @Published var errorMessage = ""
    @Published var isAuthenticated = false
    
    var isValid: Bool {
        !email.isEmpty && !password.isEmpty && email.contains("@")
    }
    
    @MainActor
    func login() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let result = try await Auth.auth().signIn(withEmail: email, password: password)
            isAuthenticated = result.user.uid.isEmpty == false
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    LoginView(isAuthenticated: .constant(false))
} 
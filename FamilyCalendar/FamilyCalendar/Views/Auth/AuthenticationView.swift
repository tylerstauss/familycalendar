import SwiftUI
import FirebaseAuth
import FirebaseFirestore

struct AuthenticationView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var isRegistering = false
    @State private var showingError = false
    @State private var errorMessage = ""
    @Binding var isAuthenticated: Bool
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    if isRegistering {
                        TextField("Display Name", text: $displayName)
                            .textContentType(.name)
                            .autocapitalization(.words)
                    }
                    
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Password", text: $password)
                        .textContentType(isRegistering ? .newPassword : .password)
                }
                
                Section {
                    Button(action: {
                        Task {
                            await authenticate()
                        }
                    }) {
                        Text(isRegistering ? "Create Account" : "Sign In")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!isValid)
                    
                    Button(action: { isRegistering.toggle() }) {
                        Text(isRegistering ? "Already have an account?" : "Create an account")
                            .frame(maxWidth: .infinity)
                    }
                    .foregroundColor(.secondary)
                }
            }
            .navigationTitle(isRegistering ? "Register" : "Sign In")
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
        }
    }
    
    private var isValid: Bool {
        if isRegistering {
            return !displayName.isEmpty && !email.isEmpty && password.count >= 6
        } else {
            return !email.isEmpty && !password.isEmpty && password.count >= 6
        }
    }
    
    private func authenticate() async {
        do {
            if isRegistering {
                print("Starting registration process...")
                let result = try await Auth.auth().createUser(withEmail: email, password: password)
                print("User created successfully with ID: \(result.user.uid)")
                
                // Create user profile in Firestore
                print("Creating user profile in Firestore...")
                let db = Firestore.firestore()
                try await db.collection("users").document(result.user.uid).setData([
                    "displayName": displayName,
                    "email": email,
                    "googleCalendarLinked": false,
                    "createdAt": Timestamp()
                ])
                print("User profile created successfully in Firestore")
            } else {
                print("Starting sign in process...")
                try await Auth.auth().signIn(withEmail: email, password: password)
                print("Sign in successful")
            }
            
            isAuthenticated = true
        } catch {
            showingError = true
            if let errorCode = AuthErrorCode(rawValue: (error as NSError).code) {
                switch errorCode {
                case .emailAlreadyInUse:
                    errorMessage = "This email is already registered. Please sign in instead."
                case .invalidEmail:
                    errorMessage = "Please enter a valid email address."
                case .weakPassword:
                    errorMessage = "Password is too weak. Please use at least 6 characters."
                case .wrongPassword:
                    errorMessage = "Incorrect password. Please try again."
                case .userNotFound:
                    errorMessage = "No account found with this email. Please register first."
                default:
                    errorMessage = "Error: \(error.localizedDescription)\nCode: \((error as NSError).code)"
                }
            } else {
                errorMessage = "Error: \(error.localizedDescription)\nCode: \((error as NSError).code)"
            }
            print("Authentication error: \(error)")
            print("Error details: \((error as NSError).userInfo)")
        }
    }
}

#Preview {
    AuthenticationView(isAuthenticated: .constant(false))
} 
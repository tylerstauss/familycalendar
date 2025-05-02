import SwiftUI
import FirebaseAuth

struct AuthenticationView: View {
    @StateObject private var viewModel = AuthenticationViewModel()
    
    var body: some View {
        Group {
            if viewModel.isAuthenticated {
                ContentView()
            } else {
                LoginView(isAuthenticated: $viewModel.isAuthenticated)
            }
        }
        .onAppear {
            viewModel.setupAuthStateListener()
        }
    }
}

class AuthenticationViewModel: ObservableObject {
    @Published var isAuthenticated = false
    private var authStateHandler: AuthStateDidChangeListenerHandle?
    
    func setupAuthStateListener() {
        if authStateHandler == nil {
            authStateHandler = Auth.auth().addStateDidChangeListener { [weak self] _, user in
                DispatchQueue.main.async {
                    self?.isAuthenticated = user != nil
                }
            }
        }
    }
    
    deinit {
        if let handler = authStateHandler {
            Auth.auth().removeStateDidChangeListener(handler)
        }
    }
}

#Preview {
    AuthenticationView()
} 
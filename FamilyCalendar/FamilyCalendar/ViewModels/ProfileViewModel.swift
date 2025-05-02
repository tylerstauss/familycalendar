import Foundation
import FirebaseAuth
import FirebaseFirestore
import GoogleSignIn

class ProfileViewModel: ObservableObject {
    @Published var currentUser: User?
    @Published var isGoogleCalendarLinked = false
    @Published var familyMembers: [FamilyMember] = []
    @Published var showingAddMember = false
    
    private var db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    
    init() {
        currentUser = Auth.auth().currentUser
        loadUserData()
    }
    
    private func loadUserData() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        // Load user profile
        db.document("users/\(userId)").getDocument { [weak self] document, error in
            if let document = document, document.exists {
                let data = document.data()
                self?.isGoogleCalendarLinked = data?["googleCalendarLinked"] as? Bool ?? false
            }
        }
        
        // Load family members
        listenerRegistration?.remove()
        listenerRegistration = db.collection("users/\(userId)/familyMembers")
            .addSnapshotListener { [weak self] querySnapshot, error in
                guard let documents = querySnapshot?.documents else {
                    print("Error fetching documents: \(error?.localizedDescription ?? "Unknown error")")
                    return
                }
                
                self?.familyMembers = documents.compactMap { document in
                    try? FamilyMember.from(document)
                }
            }
    }
    
    func signOut() {
        do {
            try Auth.auth().signOut()
            currentUser = nil
        } catch {
            print("Error signing out: \(error.localizedDescription)")
        }
    }
    
    func linkGoogleCalendar() {
        guard let clientID = FirebaseApp.app()?.options.clientID else { return }
        
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootViewController = window.rootViewController else { return }
        
        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController) { [weak self] result, error in
            guard error == nil else { return }
            guard let user = result?.user,
                  let idToken = user.idToken?.tokenString
            else { return }
            
            let credential = GoogleAuthProvider.credential(withIDToken: idToken,
                                                         accessToken: user.accessToken.tokenString)
            
            // Link the Google credential with the existing user account
            Auth.auth().currentUser?.link(with: credential) { [weak self] result, error in
                if let error = error {
                    print("Error linking Google account: \(error.localizedDescription)")
                    return
                }
                
                // Update Firestore
                guard let userId = Auth.auth().currentUser?.uid else { return }
                self?.db.document("users/\(userId)").setData([
                    "googleCalendarLinked": true
                ], merge: true)
                
                self?.isGoogleCalendarLinked = true
            }
        }
    }
    
    func unlinkGoogleCalendar() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        // Remove Google provider
        Auth.auth().currentUser?.unlink(fromProvider: "google.com") { [weak self] user, error in
            if let error = error {
                print("Error unlinking Google account: \(error.localizedDescription)")
                return
            }
            
            // Update Firestore
            self?.db.document("users/\(userId)").setData([
                "googleCalendarLinked": false
            ], merge: true)
            
            self?.isGoogleCalendarLinked = false
        }
    }
    
    deinit {
        listenerRegistration?.remove()
    }
} 
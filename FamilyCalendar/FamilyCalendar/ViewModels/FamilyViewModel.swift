import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class FamilyViewModel: ObservableObject {
    @Published var currentFamily: Family?
    @Published var familyMembers: [FamilyMember] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    private var listenerRegistration: ListenerRegistration?
    private let maxRetries = 3
    
    init() {
        Task {
            await loadCurrentFamily()
        }
    }
    
    func loadCurrentFamily() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        // Remove any existing listener
        listenerRegistration?.remove()
        
        var retryCount = 0
        while retryCount < maxRetries {
            do {
                // Listen for families where the user is a member
                listenerRegistration = db.collection("families")
                    .whereField("members", arrayContains: ["userId": userId])
                    .addSnapshotListener { [weak self] querySnapshot, error in
                        Task { @MainActor in
                            if let error = error {
                                self?.handleError(error)
                                return
                            }
                            
                            // For now, just take the first family (we can add multi-family support later)
                            if let document = querySnapshot?.documents.first {
                                do {
                                    self?.currentFamily = try Family.from(document)
                                    self?.familyMembers = self?.currentFamily?.members ?? []
                                } catch {
                                    self?.handleError(error)
                                }
                            }
                        }
                    }
                break // Success, exit retry loop
            } catch {
                retryCount += 1
                if retryCount == maxRetries {
                    handleError(error)
                } else {
                    // Wait before retrying (exponential backoff)
                    try? await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(retryCount)) * 1_000_000_000))
                }
            }
        }
    }
    
    private func handleError(_ error: Error) {
        showError = true
        if let firestoreError = error as? FirestoreErrorCode {
            switch firestoreError.code {
            case .permissionDenied:
                errorMessage = "You don't have permission to access this data. Please check your family membership."
            case .unauthenticated:
                errorMessage = "Please sign in to access your family data."
            case .unavailable:
                errorMessage = "The service is currently unavailable. Please try again later."
            default:
                errorMessage = error.localizedDescription
            }
        } else {
            errorMessage = error.localizedDescription
        }
    }
    
    @MainActor
    func createFamily(name: String) async {
        print("\n=== 🏠 FAMILY CREATION STARTED ===")
        
        guard let userId = Auth.auth().currentUser?.uid else {
            print("❌ ERROR: No user ID found")
            return
        }
        
        print("👤 User ID: \(userId)")
        print("📝 Creating new family: \(name)")
        
        let family = Family(
            id: UUID().uuidString,
            name: name,
            creatorId: userId,
            members: [
                FamilyMember(
                    id: UUID().uuidString,
                    name: "You",
                    color: "#FF0000",
                    userId: userId,
                    familyId: "",  // Will be set after creation
                    role: "owner"
                )
            ],
            createdAt: Date()
        )
        
        do {
            print("\n📦 Preparing Firestore data...")
            let familyRef = db.collection("families").document(family.id)
            var updatedFamily = family
            updatedFamily.members[0].familyId = family.id
            
            let familyData = updatedFamily.toDictionary()
            print("📄 Family data prepared:")
            print(familyData)
            
            // Test Firestore connection
            print("\n🔍 Testing Firestore connection...")
            let testDoc = try await db.collection("users").document(userId).getDocument()
            print("✅ Firestore connection test: \(testDoc.exists ? "Success" : "Document not found")")
            
            // Save family
            print("\n💾 Saving family to Firestore...")
            try await familyRef.setData(familyData)
            print("✅ Family document saved")
            
            // Verify save
            print("\n🔍 Verifying saved document...")
            let savedDoc = try await familyRef.getDocument()
            print("✅ Document verification: \(savedDoc.exists ? "Success" : "Failed")")
            if savedDoc.exists {
                print("📄 Saved data:")
                print(savedDoc.data() ?? "No data")
            }
            
            // Update local state
            print("\n🔄 Updating local state...")
            self.currentFamily = updatedFamily
            self.familyMembers = updatedFamily.members
            print("✅ Local state updated")
            
            print("\n=== 🎉 FAMILY CREATION COMPLETED ===\n")
            
        } catch {
            print("\n❌ ERROR: Family creation failed")
            print("Error type: \(type(of: error))")
            print("Error description: \(error.localizedDescription)")
            print("Full error: \(error)")
            print("=== ❌ FAMILY CREATION FAILED ===\n")
            
            showError = true
            errorMessage = error.localizedDescription
        }
    }
    
    @MainActor
    func addFamilyMember(name: String, color: String) async {
        guard let userId = Auth.auth().currentUser?.uid,
              let familyId = currentFamily?.id else { return }
        
        let newMember = FamilyMember(
            id: UUID().uuidString,
            name: name,
            color: color,
            userId: userId,
            familyId: familyId,
            role: "member"
        )
        
        do {
            var updatedFamily = currentFamily!
            updatedFamily.members.append(newMember)
            try await db.collection("families").document(familyId).setData(from: updatedFamily)
        } catch {
            showError = true
            errorMessage = error.localizedDescription
        }
    }
    
    @MainActor
    func resetAndCreateNewFamily(name: String) async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            // Delete all existing data
            // 1. Delete user's family members
            let familyMembersSnapshot = try await db.collection("users/\(userId)/familyMembers").getDocuments()
            for doc in familyMembersSnapshot.documents {
                try await doc.reference.delete()
            }
            
            // 2. Delete user's meals
            let mealsSnapshot = try await db.collection("users/\(userId)/meals").getDocuments()
            for doc in mealsSnapshot.documents {
                try await doc.reference.delete()
            }
            
            // 3. Delete user's meal plans
            let mealPlansSnapshot = try await db.collection("users/\(userId)/mealPlans").getDocuments()
            for doc in mealPlansSnapshot.documents {
                try await doc.reference.delete()
            }
            
            // 4. Find and delete any existing families where user is a member
            let familiesSnapshot = try await db.collection("families")
                .whereField("members", arrayContains: ["userId": userId])
                .getDocuments()
            
            for doc in familiesSnapshot.documents {
                // Delete all subcollections first
                let mealTemplatesSnapshot = try await db.collection("families/\(doc.documentID)/mealTemplates").getDocuments()
                for templateDoc in mealTemplatesSnapshot.documents {
                    try await templateDoc.reference.delete()
                }
                
                let mealAssignmentsSnapshot = try await db.collection("families/\(doc.documentID)/mealAssignments").getDocuments()
                for assignmentDoc in mealAssignmentsSnapshot.documents {
                    try await assignmentDoc.reference.delete()
                }
                
                let ingredientsSnapshot = try await db.collection("families/\(doc.documentID)/ingredients").getDocuments()
                for ingredientDoc in ingredientsSnapshot.documents {
                    try await ingredientDoc.reference.delete()
                }
                
                // Finally delete the family document
                try await doc.reference.delete()
            }
            
            // Create new family
            await createFamily(name: name)
            
        } catch {
            showError = true
            errorMessage = "Failed to reset data: \(error.localizedDescription)"
        }
    }
    
    deinit {
        listenerRegistration?.remove()
    }
} 
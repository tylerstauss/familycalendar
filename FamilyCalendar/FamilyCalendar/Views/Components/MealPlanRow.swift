import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct MealPlanRow: View {
    internal let title: String
    internal let meal: Meal
    @StateObject private var viewModel = MealPlanRowViewModel()
    
    internal init(title: String, meal: Meal) {
        self.title = title
        self.meal = meal
    }
    
    private var timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }()
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(title)
                    .font(.headline)
                
                Text(meal.name)
                    .font(.subheadline)
                
                if let time = meal.time {
                    Text(timeFormatter.string(from: time))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if let familyMember = viewModel.familyMember {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color(hex: familyMember.color))
                            .frame(width: 12, height: 12)
                        Text(familyMember.name)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                if let notes = meal.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .contentShape(Rectangle())
        .task {
            await viewModel.loadFamilyMember(id: meal.assigneeId)
        }
    }
}

class MealPlanRowViewModel: ObservableObject {
    @Published var familyMember: FamilyMember?
    private var db = Firestore.firestore()
    
    @MainActor
    func loadFamilyMember(id: String) async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        do {
            let document = try await db.collection("users/\(userId)/familyMembers").document(id).getDocument()
            if document.exists {
                familyMember = try document.data(as: FamilyMember.self)
            }
        } catch {
            print("Error loading family member: \(error.localizedDescription)")
        }
    }
}

#Preview {
    MealPlanRow(
        title: "Breakfast",
        meal: Meal(
            id: "1",
            name: "Pancakes",
            type: "Breakfast",
            ingredients: ["Flour", "Eggs", "Milk"],
            notes: "Family favorite recipe",
            assigneeId: "user1",
            userId: "user1",
            time: Date()
        )
    )
} 
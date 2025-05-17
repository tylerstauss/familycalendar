import SwiftUI
import FirebaseFirestore

struct MealView: View {
    @StateObject private var viewModel = MealViewModel()
    let meal: MealAssignment
    
    var body: some View {
        Group {
            if let template = viewModel.template {
                VStack(alignment: .leading, spacing: 4) {
                    Text(template.name)
                        .font(.caption)
                        .lineLimit(1)
                    
                    if let notes = template.notes {
                        Text(notes)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(4)
                .frame(maxWidth: 120)
                .background(Color.green.opacity(0.2))
                .cornerRadius(4)
            } else {
                ProgressView()
                    .padding(4)
                    .frame(width: 120, height: 30)
            }
        }
        .task {
            await viewModel.loadTemplate(templateId: meal.templateId, familyId: meal.familyId)
        }
    }
}

class MealViewModel: ObservableObject {
    @Published var template: MealTemplate?
    private let db = Firestore.firestore()
    
    @MainActor
    func loadTemplate(templateId: String, familyId: String) async {
        do {
            let docSnapshot = try await db.collection("families")
                .document(familyId)
                .collection("mealTemplates")
                .document(templateId)
                .getDocument()
            
            if docSnapshot.exists {
                self.template = try? docSnapshot.data(as: MealTemplate.self)
            }
        } catch {
            print("Error loading meal template: \(error)")
        }
    }
} 
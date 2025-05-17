import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct MealLibraryView: View {
    @StateObject private var viewModel = MealLibraryViewModel()
    @EnvironmentObject private var familyViewModel: FamilyViewModel
    @State private var showingAddMeal = false
    
    var body: some View {
        NavigationView {
            List {
                ForEach(viewModel.mealTemplates) { template in
                    NavigationLink(destination: MealTemplateDetailView(template: template)) {
                        VStack(alignment: .leading) {
                            Text(template.name)
                                .font(.headline)
                            Text(template.type)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            if !template.ingredients.isEmpty {
                                Text("\(template.ingredients.count) ingredients")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Meal Library")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingAddMeal = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddMeal) {
                SaveMealTemplateView()
            }
            .task {
                await viewModel.loadMealTemplates()
            }
        }
    }
}

class MealLibraryViewModel: ObservableObject {
    @Published var mealTemplates: [MealTemplate] = []
    private var db = Firestore.firestore()
    
    @MainActor
    func loadMealTemplates() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        do {
            // First get the user's family
            let familySnapshot = try await db.collection("families")
                .whereField("members", arrayContains: ["userId": userId])
                .getDocuments()
            
            guard let familyId = familySnapshot.documents.first?.documentID else { return }
            
            // Then load the meal templates for that family
            let templatesSnapshot = try await db.collection("families/\(familyId)/mealTemplates").getDocuments()
            mealTemplates = templatesSnapshot.documents.compactMap { try? MealTemplate.from($0) }
        } catch {
            print("Error loading meal templates: \(error.localizedDescription)")
        }
    }
}

struct MealTemplateDetailView: View {
    let template: MealTemplate
    @State private var showingAssignMeal = false
    
    var body: some View {
        Form {
            Section("Details") {
                Text("Name: \(template.name)")
                Text("Type: \(template.type)")
            }
            
            Section("Ingredients") {
                ForEach(template.ingredients, id: \.self) { ingredient in
                    Text(ingredient)
                }
            }
            
            if let notes = template.notes {
                Section("Notes") {
                    Text(notes)
                }
            }
            
            Button("Assign to Calendar") {
                showingAssignMeal = true
            }
        }
        .navigationTitle(template.name)
        .sheet(isPresented: $showingAssignMeal) {
            AssignMealView(template: template)
        }
    }
} 
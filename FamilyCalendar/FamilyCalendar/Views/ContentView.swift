import SwiftUI
import Foundation
import FirebaseAuth

struct ContentView: View {
    @Binding var isAuthenticated: Bool
    @EnvironmentObject private var familyViewModel: FamilyViewModel
    @State private var selectedDate = Date()
    @State private var showingFamilySetup = false
    
    var body: some View {
        NavigationView {
            List {
                NavigationLink(destination: DayView(date: selectedDate)) {
                    Label("Today", systemImage: "calendar")
                }
                
                NavigationLink(destination: MealLibraryView()) {
                    Label("Meal Library", systemImage: "book")
                }
                
                Button {
                    showingFamilySetup = true
                } label: {
                    Label("Family Settings", systemImage: "person.2")
                }
            }
            .navigationTitle("Family Calendar")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign Out") {
                        do {
                            try Auth.auth().signOut()
                            isAuthenticated = false
                        } catch {
                            print("Error signing out: \(error.localizedDescription)")
                        }
                    }
                }
            }
            .task {
                // Show family setup if no family exists
                if familyViewModel.currentFamily == nil {
                    showingFamilySetup = true
                }
            }
            .sheet(isPresented: $showingFamilySetup) {
                FamilySetupView()
            }
        }
    }
} 
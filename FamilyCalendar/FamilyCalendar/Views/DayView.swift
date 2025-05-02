import SwiftUI

struct DayView: View {
    @StateObject private var viewModel = DayViewModel()
    
    var body: some View {
        NavigationView {
            List {
                Section("Events") {
                    if viewModel.events.isEmpty {
                        Text("No events for today")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(viewModel.events) { event in
                            EventRow(event: event)
                        }
                    }
                }
                
                Section("Meals") {
                    MealPlanRow(title: "Breakfast", meal: viewModel.meals.breakfast)
                    MealPlanRow(title: "Lunch", meal: viewModel.meals.lunch)
                    MealPlanRow(title: "Dinner", meal: viewModel.meals.dinner)
                }
            }
            .navigationTitle("Today")
            .toolbar {
                Button(action: { viewModel.showingAddEvent = true }) {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $viewModel.showingAddEvent) {
                AddEventView()
            }
        }
    }
}

#Preview {
    DayView()
} 
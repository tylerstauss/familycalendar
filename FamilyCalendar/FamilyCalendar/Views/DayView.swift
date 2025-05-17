import SwiftUI
import Foundation
import FirebaseFirestore
import FirebaseAuth

struct DayView: View {
    @StateObject private var viewModel = DayViewModel()
    @EnvironmentObject private var familyViewModel: FamilyViewModel
    @State private var showingAddEvent = false
    let date: Date
    
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(familyViewModel.familyMembers) { member in
                    DayScheduleView(
                        member: member,
                        events: viewModel.events(for: member.id),
                        meals: viewModel.meals(for: member.id),
                        hourHeight: 60,
                        startHour: 6
                    )
                    .padding(.vertical, 8)
                    
                    if member.id != familyViewModel.familyMembers.last?.id {
                        Divider()
                    }
                }
            }
            .padding()
        }
        .navigationTitle(date.formatted(date: .complete, time: .omitted))
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showingAddEvent = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddEvent) {
            AddEventView(date: date)
        }
        .task {
            if let familyId = familyViewModel.currentFamily?.id {
                await viewModel.loadData(for: date, familyId: familyId)
            }
        }
    }
}

struct MealDetailView: View {
    let viewModel: DayViewModel
    let meal: MealAssignment
    
    var body: some View {
        if let template = viewModel.template(for: meal) {
            Text(template.name)
                .padding(4)
                .background(Color.green.opacity(0.2))
                .cornerRadius(4)
        }
    }
}

#Preview {
    DayView(date: Date())
} 
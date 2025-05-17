import SwiftUI

struct WeekView: View {
    @StateObject private var viewModel: WeekViewModel
    let date: Date
    
    init(date: Date) {
        self.date = date
        _viewModel = StateObject(wrappedValue: WeekViewModel(initialDate: date))
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Week header with dates
                    HStack {
                        ForEach(viewModel.weekDays, id: \.self) { date in
                            VStack {
                                Text(viewModel.weekdayName(for: date))
                                    .font(.caption)
                                Text(viewModel.dayNumber(for: date))
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .padding()
                    
                    // Events grid
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 10) {
                        ForEach(viewModel.weekEvents) { event in
                            EventCard(event: event)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Week")
            .toolbar {
                Button(action: { viewModel.showingAddEvent = true }) {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $viewModel.showingAddEvent) {
                AddEventView(date: viewModel.weekDays.first ?? Date())
            }
        }
    }
}

#Preview {
    WeekView(date: Date())
} 
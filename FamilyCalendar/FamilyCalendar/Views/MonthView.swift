import SwiftUI

struct MonthView: View {
    @StateObject private var viewModel: MonthViewModel
    let date: Date
    
    init(date: Date) {
        self.date = date
        _viewModel = StateObject(wrappedValue: MonthViewModel(initialDate: date))
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Month header
                    HStack {
                        Button(action: viewModel.previousMonth) {
                            Image(systemName: "chevron.left")
                        }
                        
                        Text(viewModel.monthYearString)
                            .font(.title2)
                            .frame(maxWidth: .infinity)
                        
                        Button(action: viewModel.nextMonth) {
                            Image(systemName: "chevron.right")
                        }
                    }
                    .padding()
                    
                    // Weekday headers
                    HStack {
                        ForEach(viewModel.weekdaySymbols, id: \.self) { symbol in
                            Text(symbol)
                                .frame(maxWidth: .infinity)
                                .font(.caption)
                        }
                    }
                    
                    // Calendar grid
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 10) {
                        ForEach(viewModel.daysInMonth, id: \.self) { date in
                            if let date = date {
                                DayCell(date: date, events: viewModel.events(for: date))
                                    .frame(height: 80)
                                    .onTapGesture {
                                        viewModel.selectedDate = date
                                        viewModel.showingAddEvent = true
                                    }
                            } else {
                                Color.clear
                                    .frame(height: 80)
                            }
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Month")
            .toolbar {
                Button(action: {
                    viewModel.selectedDate = viewModel.currentDate
                    viewModel.showingAddEvent = true
                }) {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $viewModel.showingAddEvent) {
                AddEventView(date: viewModel.selectedDate ?? Date())
            }
        }
    }
}

#Preview {
    MonthView(date: Date())
} 
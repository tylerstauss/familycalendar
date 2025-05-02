import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DayView()
                .tabItem {
                    Label("Day", systemImage: "calendar.day.timeline.left")
                }
            
            WeekView()
                .tabItem {
                    Label("Week", systemImage: "calendar")
                }
            
            MonthView()
                .tabItem {
                    Label("Month", systemImage: "calendar.month")
                }
            
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle")
                }
        }
    }
}

#Preview {
    ContentView()
} 
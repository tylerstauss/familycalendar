import SwiftUI

struct DayCell: View {
    let date: Date
    let events: [Event]
    
    private var dayNumber: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
    
    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(dayNumber)
                .font(.subheadline)
                .foregroundColor(isToday ? .white : .primary)
                .frame(width: 24, height: 24)
                .background(isToday ? Color.blue : Color.clear)
                .clipShape(Circle())
            
            if events.isEmpty {
                Spacer()
            } else {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(events.prefix(3)) { event in
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(Color(hex: event.colors.first ?? "#000000"))
                                    .frame(width: 6, height: 6)
                                
                                Text(event.title)
                                    .font(.caption2)
                                    .lineLimit(1)
                                
                                if event.isGoogleEvent {
                                    Image(systemName: "g.circle.fill")
                                        .font(.caption2)
                                        .foregroundColor(.blue)
                                }
                                
                                if event.assignees.count > 1 {
                                    Text("+\(event.assignees.count - 1)")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        
                        if events.count > 3 {
                            Text("+\(events.count - 3) more")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .padding(4)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(8)
    }
}

#Preview {
    DayCell(
        date: Date(),
        events: [
            Event(
                id: "1",
                title: "Team Meeting",
                startTime: Date(),
                endTime: Date().addingTimeInterval(3600),
                location: "Conference Room",
                notes: nil,
                assignees: ["Alice", "Bob"],
                colors: ["#FF0000", "#00FF00"],
                isGoogleEvent: false,
                userId: "user1"
            ),
            Event(
                id: "2",
                title: "Lunch",
                startTime: Date().addingTimeInterval(7200),
                endTime: Date().addingTimeInterval(10800),
                location: "Cafeteria",
                notes: nil,
                assignees: ["Bob", "Charlie", "David"],
                colors: ["#00FF00", "#0000FF", "#FF00FF"],
                isGoogleEvent: true,
                userId: "user1"
            )
        ]
    )
} 
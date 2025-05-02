import SwiftUI

struct EventCard: View {
    let event: Event
    
    private var timeString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: event.startTime)
    }
    
    private var dayString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: event.startTime)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(dayString)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if event.isGoogleEvent {
                    Image(systemName: "g.circle.fill")
                        .foregroundColor(.blue)
                }
            }
            
            Text(event.title)
                .font(.headline)
                .lineLimit(1)
            
            Text(timeString)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if let location = event.location {
                Text(location)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            if let assignee = event.assignee {
                HStack {
                    Text(assignee)
                        .font(.caption)
                    Circle()
                        .fill(Color(hex: event.color))
                        .frame(width: 8, height: 8)
                }
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
    }
}

#Preview {
    EventCard(
        event: Event(
            id: "1",
            title: "Team Meeting",
            startTime: Date(),
            endTime: Date().addingTimeInterval(3600),
            location: "Conference Room",
            notes: "Weekly sync",
            assignee: "Alice",
            color: "#FF0000",
            isGoogleEvent: false,
            userId: "user1"
        )
    )
} 
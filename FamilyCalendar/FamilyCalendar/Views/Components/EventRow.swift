import SwiftUI

struct EventRow: View {
    let event: Event
    
    private var timeString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return "\(formatter.string(from: event.startTime)) - \(formatter.string(from: event.endTime))"
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(event.title)
                    .font(.headline)
                
                Spacer()
                
                if event.isGoogleEvent {
                    Image(systemName: "g.circle.fill")
                        .foregroundColor(.blue)
                }
            }
            
            Text(timeString)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if let location = event.location {
                Text(location)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            if let assignee = event.assignee {
                HStack {
                    Text(assignee)
                        .font(.caption)
                    Circle()
                        .fill(Color(hex: event.color))
                        .frame(width: 10, height: 10)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
} 
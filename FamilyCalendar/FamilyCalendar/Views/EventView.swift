import SwiftUI

struct EventView: View {
    let event: Event
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(event.title)
                .font(.caption)
                .lineLimit(1)
            
            if let location = event.location {
                Text(location)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(4)
        .frame(maxWidth: 120)
        .background(Color.blue.opacity(0.2))
        .cornerRadius(4)
    }
} 
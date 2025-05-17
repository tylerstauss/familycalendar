import SwiftUI
import FirebaseFirestore
import FirebaseAuth
import Foundation

struct DayScheduleView: View {
    let member: FamilyMember
    let events: [Event]
    let meals: [MealAssignment]
    let hourHeight: CGFloat
    let startHour: Int
    
    private let timeSlots = stride(from: 6, through: 20, by: 1).map { hour in
        Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date())!
    }
    
    private let timeColumnWidth: CGFloat = 60
    private let memberColumnWidth: CGFloat = 120
    
    // Add validation for time-based calculations
    private func validateTime(_ date: Date) -> Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.hour, .minute], from: date)
        let hour = max(startHour, min(20, components.hour ?? startHour))
        let minute = max(0, min(59, components.minute ?? 0))
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: date) ?? date
    }
    
    // Add safe position calculation
    private func calculatePosition(for date: Date) -> CGFloat {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.hour, .minute], from: validateTime(date))
        let hour = components.hour ?? startHour
        let minute = components.minute ?? 0
        let position = CGFloat(hour - startHour) * hourHeight + (CGFloat(minute) / 60.0) * hourHeight
        return max(0, min(position, hourHeight * 16)) // Constrain to view bounds
    }
    
    var body: some View {
        VStack(alignment: .leading) {
            // Member header
            VStack {
                Circle()
                    .fill(Color(hex: member.color))
                    .frame(width: 30, height: 30)
                Text(member.name)
                    .font(.caption)
            }
            .frame(width: memberColumnWidth)
            .padding(.vertical, 8)
            .background(Color(.systemGray6))
            
            // Schedule
            ZStack(alignment: .topLeading) {
                // Hour lines
                VStack(spacing: 0) {
                    ForEach(0..<16) { hour in
                        VStack {
                            Divider()
                            Spacer()
                        }
                        .frame(height: hourHeight)
                    }
                }
                
                // Events with safe positioning
                ForEach(events) { event in
                    EventView(event: event)
                        .position(x: timeColumnWidth + memberColumnWidth/2,
                                y: calculatePosition(for: event.startTime))
                }
                
                // Meals with safe positioning
                ForEach(meals) { meal in
                    MealView(meal: meal)
                        .position(x: timeColumnWidth + memberColumnWidth/2,
                                y: calculatePosition(for: meal.time))
                }
            }
            .frame(height: hourHeight * 16)
        }
    }
} 
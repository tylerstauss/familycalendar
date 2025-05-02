import SwiftUI

struct MealPlanRow: View {
    let title: String
    let meal: Meal?
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(title)
                    .font(.headline)
                
                if let meal = meal {
                    Text(meal.name)
                        .font(.subheadline)
                    Text("\(meal.ingredients.count) ingredients")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("No meal planned")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .contentShape(Rectangle())
    }
}

#Preview {
    MealPlanRow(
        title: "Breakfast",
        meal: Meal(
            id: "1",
            name: "Pancakes",
            ingredients: ["Flour", "Eggs", "Milk"],
            userId: "user1"
        )
    )
} 
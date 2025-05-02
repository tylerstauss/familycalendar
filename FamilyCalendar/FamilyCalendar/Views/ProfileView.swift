import SwiftUI
import FirebaseAuth

struct ProfileView: View {
    @StateObject private var viewModel = ProfileViewModel()
    
    var body: some View {
        NavigationView {
            List {
                Section("Account") {
                    if let user = viewModel.currentUser {
                        Text(user.displayName ?? "No Name")
                        Text(user.email ?? "No Email")
                    }
                    
                    Button(action: viewModel.signOut) {
                        Text("Sign Out")
                            .foregroundColor(.red)
                    }
                }
                
                Section("Calendar Integration") {
                    if viewModel.isGoogleCalendarLinked {
                        Button(action: viewModel.unlinkGoogleCalendar) {
                            Text("Unlink Google Calendar")
                                .foregroundColor(.red)
                        }
                    } else {
                        Button(action: viewModel.linkGoogleCalendar) {
                            Text("Link Google Calendar")
                        }
                    }
                }
                
                Section("Family Members") {
                    ForEach(viewModel.familyMembers) { member in
                        HStack {
                            Text(member.name)
                            Spacer()
                            Circle()
                                .fill(Color(hex: member.color))
                                .frame(width: 20, height: 20)
                        }
                    }
                    
                    Button(action: { viewModel.showingAddMember = true }) {
                        Label("Add Family Member", systemImage: "person.badge.plus")
                    }
                }
            }
            .navigationTitle("Profile")
            .sheet(isPresented: $viewModel.showingAddMember) {
                AddFamilyMemberView()
            }
        }
    }
}

#Preview {
    ProfileView()
} 
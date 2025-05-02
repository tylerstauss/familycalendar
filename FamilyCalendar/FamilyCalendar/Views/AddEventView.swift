import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct AddEventView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AddEventViewModel()
    
    let date: Date
    
    var body: some View {
        NavigationView {
            Form {
                Section("Event Details") {
                    TextField("Title", text: $viewModel.title)
                    DatePicker("Start Time", selection: $viewModel.startTime, in: date...)
                    DatePicker("End Time", selection: $viewModel.endTime, in: viewModel.startTime...)
                    TextField("Location", text: $viewModel.location)
                    TextField("Notes", text: $viewModel.notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                
                Section("Assignment") {
                    if viewModel.isLoadingMembers {
                        ProgressView()
                    } else {
                        ForEach(viewModel.familyMembers) { member in
                            HStack {
                                Circle()
                                    .fill(Color(hex: member.color))
                                    .frame(width: 20, height: 20)
                                Text(member.name)
                                Spacer()
                                if viewModel.selectedMemberId == member.id {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.selectedMemberId = member.id
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await viewModel.saveEvent()
                            dismiss()
                        }
                    }
                    .disabled(!viewModel.isValid)
                }
            }
            .alert("Error", isPresented: $viewModel.showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage)
            }
            .task {
                await viewModel.loadFamilyMembers()
                viewModel.startTime = date
                viewModel.endTime = Calendar.current.date(byAdding: .hour, value: 1, to: date) ?? date
            }
        }
    }
}

class AddEventViewModel: ObservableObject {
    @Published var title = ""
    @Published var startTime = Date()
    @Published var endTime = Date()
    @Published var location = ""
    @Published var notes = ""
    @Published var selectedMemberId: String?
    @Published var familyMembers: [FamilyMember] = []
    @Published var isLoadingMembers = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    
    var isValid: Bool {
        !title.isEmpty && selectedMemberId != nil && endTime > startTime
    }
    
    @MainActor
    func loadFamilyMembers() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        isLoadingMembers = true
        defer { isLoadingMembers = false }
        
        do {
            let snapshot = try await db.collection("users/\(userId)/familyMembers").getDocuments()
            familyMembers = snapshot.documents.compactMap { try? $0.data(as: FamilyMember.self) }
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
    
    @MainActor
    func saveEvent() async {
        guard let userId = Auth.auth().currentUser?.uid,
              let memberId = selectedMemberId else { return }
        
        let event = Event(
            id: UUID().uuidString,
            title: title,
            startTime: startTime,
            endTime: endTime,
            location: location.isEmpty ? nil : location,
            notes: notes.isEmpty ? nil : notes,
            userId: userId,
            assignedTo: memberId,
            isGoogleEvent: false
        )
        
        do {
            try await db.collection("users/\(userId)/events").document(event.id).setData(from: event)
        } catch {
            showingError = true
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    AddEventView(date: Date())
} 
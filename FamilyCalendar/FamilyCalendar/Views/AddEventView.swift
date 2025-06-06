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
                                if viewModel.selectedMemberIds.contains(member.id) {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.toggleMember(member.id)
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
    @Published var selectedMemberIds: Set<String> = []
    @Published var familyMembers: [FamilyMember] = []
    @Published var isLoadingMembers = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private var db = Firestore.firestore()
    
    var isValid: Bool {
        !title.isEmpty && !selectedMemberIds.isEmpty && endTime > startTime
    }
    
    func toggleMember(_ memberId: String) {
        if selectedMemberIds.contains(memberId) {
            selectedMemberIds.remove(memberId)
        } else {
            selectedMemberIds.insert(memberId)
        }
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
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        let selectedMembers = familyMembers.filter { selectedMemberIds.contains($0.id) }
        let memberColors = selectedMembers.map { $0.color }
        
        let event = Event(
            id: UUID().uuidString,
            title: title,
            startTime: startTime,
            endTime: endTime,
            location: location.isEmpty ? nil : location,
            notes: notes.isEmpty ? nil : notes,
            assignees: Array(selectedMemberIds),
            colors: memberColors,
            isGoogleEvent: false,
            userId: userId
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
import Foundation
import GoogleSignIn
import GoogleAPIClientForREST_Calendar
import FirebaseAuth
import FirebaseFirestore

class GoogleCalendarService: ObservableObject {
    static let shared = GoogleCalendarService()
    private let service = GTLRCalendarService()
    private let db = Firestore.firestore()
    
    @Published var isAuthorized = false
    
    private init() {
        checkAuthorizationStatus()
    }
    
    func checkAuthorizationStatus() {
        if let user = GIDSignIn.sharedInstance.currentUser,
           let scopes = user.grantedScopes,
           !scopes.contains(where: { $0.hasSuffix("calendar") }) {
            isAuthorized = false
        } else {
            isAuthorized = GIDSignIn.sharedInstance.hasPreviousSignIn()
        }
    }
    
    func signIn() async throws {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else {
            throw CalendarError.missingClientId
        }
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootViewController = window.rootViewController else {
            throw CalendarError.missingViewController
        }
        
        // Configure GIDSignIn with the client ID
        let signIn = GIDSignIn.sharedInstance
        signIn.configuration = GIDConfiguration(clientID: clientID)
        
        let result = try await signIn.signIn(
            withPresenting: rootViewController,
            hint: Auth.auth().currentUser?.email,
            additionalScopes: [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events"
            ]
        )
        
        // Store refresh token in Firestore
        if let userId = Auth.auth().currentUser?.uid {
            try await db.collection("users").document(userId).updateData([
                "googleCalendarLinked": true,
                "googleRefreshToken": result.user.refreshToken
            ])
        }
        
        isAuthorized = true
        service.authorizer = result.user.fetcherAuthorizer
    }
    
    func fetchEvents(startDate: Date, endDate: Date) async throws -> [GTLRCalendar_Event] {
        let query = GTLRCalendarQuery_EventsList.query(withCalendarId: "primary")
        query.timeMin = GTLRDateTime(date: startDate)
        query.timeMax = GTLRDateTime(date: endDate)
        query.singleEvents = true
        query.orderBy = kGTLRCalendarOrderByStartTime
        
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[GTLRCalendar_Event], Error>) in
            service.executeQuery(query) { (callbackTicket: GTLRServiceTicket?, result: Any?, error: Error?) in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let eventsList = result as? GTLRCalendar_Events else {
                    continuation.resume(throwing: CalendarError.invalidResponse)
                    return
                }
                
                continuation.resume(returning: eventsList.items ?? [])
            }
        }
    }
    
    func createEvent(_ event: Event) async throws -> GTLRCalendar_Event {
        let calendarEvent = GTLRCalendar_Event()
        calendarEvent.summary = event.title
        calendarEvent.descriptionProperty = event.notes
        calendarEvent.location = event.location
        
        // Add assignees as attendees
        if !event.assignees.isEmpty {
            calendarEvent.attendees = event.assignees.map { assignee in
                let attendee = GTLRCalendar_EventAttendee()
                attendee.displayName = assignee
                return attendee
            }
        }
        
        let startDateTime = GTLRDateTime(date: event.startTime)
        let endDateTime = GTLRDateTime(date: event.endTime)
        
        let startEventDateTime = GTLRCalendar_EventDateTime()
        startEventDateTime.dateTime = startDateTime
        calendarEvent.start = startEventDateTime
        
        let endEventDateTime = GTLRCalendar_EventDateTime()
        endEventDateTime.dateTime = endDateTime
        calendarEvent.end = endEventDateTime
        
        // Add color information in the description if needed
        if !event.colors.isEmpty {
            let colorInfo = "Assigned colors: " + zip(event.assignees, event.colors)
                .map { "\($0): \($1)" }
                .joined(separator: ", ")
            calendarEvent.descriptionProperty = [event.notes, colorInfo]
                .compactMap { $0 }
                .joined(separator: "\n\n")
        }
        
        let query = GTLRCalendarQuery_EventsInsert.query(withObject: calendarEvent, calendarId: "primary")
        
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<GTLRCalendar_Event, Error>) in
            service.executeQuery(query) { (callbackTicket: GTLRServiceTicket?, result: Any?, error: Error?) in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let createdEvent = result as? GTLRCalendar_Event else {
                    continuation.resume(throwing: CalendarError.invalidResponse)
                    return
                }
                
                continuation.resume(returning: createdEvent)
            }
        }
    }
    
    @MainActor
    func signOut() async throws {
        GIDSignIn.sharedInstance.signOut()
        isAuthorized = false
        
        // Update Firestore if needed
        if let userId = Auth.auth().currentUser?.uid {
            try await db.collection("users").document(userId).updateData([
                "googleCalendarLinked": false,
                "googleRefreshToken": FieldValue.delete()
            ])
        }
    }
}

enum CalendarError: Error {
    case missingClientId
    case missingViewController
    case signInFailed
    case invalidResponse
    
    var localizedDescription: String {
        switch self {
        case .missingClientId:
            return "Google Client ID not found in Info.plist"
        case .missingViewController:
            return "Could not find a view controller to present sign-in"
        case .signInFailed:
            return "Failed to sign in with Google"
        case .invalidResponse:
            return "Received invalid response from Google Calendar"
        }
    }
} 
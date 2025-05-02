import Foundation
import GoogleSignIn
import GoogleAPIClientForREST
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
           !user.grantedScopes.contains(where: { $0.hasSuffix("calendar") }) {
            isAuthorized = false
        } else {
            isAuthorized = GIDSignIn.sharedInstance.hasPreviousSignIn()
        }
    }
    
    func signIn() async throws {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else {
            throw CalendarError.missingClientId
        }
        
        let config = GIDConfiguration(clientID: clientID)
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootViewController = window.rootViewController else {
            throw CalendarError.missingViewController
        }
        
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: rootViewController,
            hint: Auth.auth().currentUser?.email,
            additionalScopes: [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events"
            ]
        )
        
        guard let user = result.user else {
            throw CalendarError.signInFailed
        }
        
        // Store refresh token in Firestore
        if let userId = Auth.auth().currentUser?.uid,
           let refreshToken = user.refreshToken?.tokenString {
            try await db.collection("users").document(userId).updateData([
                "googleCalendarLinked": true,
                "googleRefreshToken": refreshToken
            ])
        }
        
        isAuthorized = true
        service.authorizer = user.fetcherAuthorizer
    }
    
    func fetchEvents(startDate: Date, endDate: Date) async throws -> [GTLRCalendar_Event] {
        let query = GTLRCalendarQuery_EventsList.query(withCalendarId: "primary")
        query.timeMin = GTLRDateTime(date: startDate)
        query.timeMax = GTLRDateTime(date: endDate)
        query.singleEvents = true
        query.orderBy = "startTime"
        
        let result = try await withCheckedThrowingContinuation { continuation in
            service.executeQuery(query) { callbackTicket, result, error in
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
        
        return result
    }
    
    func createEvent(_ event: Event) async throws -> GTLRCalendar_Event {
        let calendarEvent = GTLRCalendar_Event()
        calendarEvent.summary = event.title
        calendarEvent.descriptionProperty = event.notes
        calendarEvent.location = event.location
        
        let startDateTime = GTLRDateTime(date: event.startTime)
        let endDateTime = GTLRDateTime(date: event.endTime)
        
        calendarEvent.start = GTLRCalendar_EventDateTime()
        calendarEvent.start?.dateTime = startDateTime
        
        calendarEvent.end = GTLRCalendar_EventDateTime()
        calendarEvent.end?.dateTime = endDateTime
        
        let query = GTLRCalendarQuery_EventsInsert.query(withObject: calendarEvent, calendarId: "primary")
        
        let result = try await withCheckedThrowingContinuation { continuation in
            service.executeQuery(query) { callbackTicket, result, error in
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
        
        return result
    }
    
    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        isAuthorized = false
        
        // Update Firestore if needed
        if let userId = Auth.auth().currentUser?.uid {
            try? await db.collection("users").document(userId).updateData([
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
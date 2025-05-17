import SwiftUI
import FirebaseCore
import FirebaseAuth
import GoogleSignIn
import GoogleSignInSwift
import FirebaseAppCheck
import FirebaseFirestore

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        
        print("🔧 Starting Firebase configuration...")
        
        // Configure App Check before Firebase
        #if DEBUG
        print("🔧 Setting up App Check Debug Provider")
        let providerFactory = AppCheckDebugProviderFactory()
        AppCheck.setAppCheckProviderFactory(providerFactory)
        #else
        if #available(iOS 14.0, *) {
            print("🔧 Setting up Device Check Provider")
            let providerFactory = DeviceCheckProviderFactory()
            AppCheck.setAppCheckProviderFactory(providerFactory)
        } else {
            print("🔧 Setting up App Attest Provider")
            let providerFactory = AppAttestProviderFactory()
            AppCheck.setAppCheckProviderFactory(providerFactory)
        }
        #endif
        
        // Configure Firebase after App Check
        FirebaseApp.configure()
        
        // Verify Firebase configuration
        if let app = FirebaseApp.app() {
            print("✅ Firebase configured successfully")
            print("📱 Firebase app name: \(app.name)")
        } else {
            print("❌ Firebase configuration failed")
        }
        
        // Configure Google Sign-In if available
        if let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String {
            print("✅ Google Sign-In configured with client ID")
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        } else {
            print("⚠️ Google Sign-In client ID not found")
        }
        
        return true
    }
    
    // Add this method to handle App Check debug token
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        if url.scheme?.lowercased() == "appcheck-debug" {
            print("🔧 Setting up App Check debug token from URL")
            AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
            return true
        }
        return false
    }
}

@main
struct FamilyCalendarApp: App {
    // register app delegate for Firebase setup
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var authViewModel = AuthenticationViewModel()
    @StateObject private var familyViewModel = FamilyViewModel()
    
    var body: some Scene {
        WindowGroup {
            if authViewModel.isAuthenticated {
                ContentView(isAuthenticated: $authViewModel.isAuthenticated)
                    .environmentObject(familyViewModel)
            } else {
                AuthenticationView(isAuthenticated: $authViewModel.isAuthenticated)
            }
        }
    }
} 


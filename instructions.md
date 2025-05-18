# Skylight-Like Calendar App Development Guide for Junior Engineers
> *Note: This guide assumes you are a junior software developer. Pay special attention to content prefixed with **[JR DEV TIP]** or structured as additional bullet points/notes. These provide context, examples, warnings about common pitfalls, and actionable advice.*

This document provides a comprehensive, step-by-step guide for building a family calendar application similar to Skylight Calendar, designed for both iPad and iPhone. It outlines the technology stack, features to implement, and a detailed development roadmap suitable for a junior engineer, enriched with insights and best practices from a senior web development perspective.

> **[JR DEV TIP]**: Think of this guide like a map. Don't feel pressured to understand everything perfectly upfront. Focus on one phase at a time. Break down larger tasks into smaller, manageable steps. Ask questions when you're stuck!

## 1. Technology Stack (Web-Minded Deep Dive)

### Programming Language: Swift
- For native iOS and iPadOS development
- Think of Swift as the strongly-typed engine powering your frontend
- Its safety features and modern syntax are crucial for building robust mobile applications, much like TypeScript enhances JavaScript in web development

> **[JR DEV TIP]**: If you're new to Swift, focus on the basics first:
> - variables/constants (var/let)
> - optionals (?, !)
> - control flow (if, guard, for)
> - data structures (arrays, dictionaries, sets)
> - functions
> - structs/classes
> Don't worry about advanced features initially.

### UI Framework: SwiftUI
- For modern, declarative UI development
- SwiftUI's declarative approach mirrors frontend frameworks like React or Vue.js
- Simplifies UI development and makes it more maintainable

> **[JR DEV TIP]**: Start with basic SwiftUI views:
> - Text
> - Image
> - Button
> - VStack
> - HStack
> - List
> Learn how state management works using @State for simple view-local state and later @ObservedObject or @StateObject for data coming from elsewhere (like Firebase). Break complex views into smaller, reusable subviews.

### Backend & Cloud Services: Firebase (Google Cloud)

#### Firestore
- NoSQL document database for storing and syncing data
- Flexible, JSON-like structure for modeling complex family data
- Consider trade-offs between relational databases and NoSQL for this project

> **[JR DEV TIP]**: Think of Firestore like nested folders (collections) containing files (documents), where each file is a JSON object (key-value pairs). For example:
> ```
> users/
>   └── user_id/
>       └── profile
>           ├── displayName: "User Name"
>           └── settings: {...}
> ```
> Be mindful of Firestore costs – reads/writes/deletes have associated costs, so query efficiently.

#### Authentication
- Secure user identity management
- Firebase Authentication handles user registration, login, and various authentication methods

> **[JR DEV TIP]**: 
> - Start with basic email/password authentication
> - Firebase provides UI libraries (FirebaseAuthUI) that can speed this up
> - Remember to implement Firebase Security Rules to protect user data

#### Cloud Functions
- Serverless compute for backend logic
- Run backend code in response to events without managing servers
- Critical for secure API interactions and complex data processing

> **[JR DEV TIP]**: 
> - Write functions in Node.js (JavaScript) or Python
> - Essential for keeping API keys secure
> - Use Firebase CLI for deployment and testing
> - Start with HTTPS-triggered functions

#### Calendar Integration: Google Calendar API
- Implement via secure backend integration
- Critical for security and maintainability
- Never expose API keys in client code

> **[JR DEV TIP]**: OAuth 2.0 flow:
> 1. App gets temporary code from Google Sign-In
> 2. Code sent to Cloud Function
> 3. Cloud Function exchanges code for tokens
> 4. Store refresh token securely in Firestore

### Optional Components

#### On-Device Machine Learning
- Core ML for potential future AI features
- Privacy-preserving AI features

> **[JR DEV TIP]**: Skip this for MVP - focus on core features first.

### Development Environment

#### Xcode
- Primary tool for iOS development
- Master debugging tools, build settings, simulators, and profiling

> **[JR DEV TIP]**: Get comfortable with:
> - Project navigator (left)
> - Editor (center)
> - Inspector (right)
> - Debug console (bottom)
> - Setting breakpoints
> - Inspecting variables
> - Using simulators

#### Version Control: Git
- Essential for tracking changes and collaboration
- Use platforms like GitHub, GitLab, or Bitbucket

> **[JR DEV TIP]**: Basic Git commands to know:
> ```bash
> git clone
> git add .
> git commit -m "Your message"
> git push
> git pull
> ```
> Use a simple branching strategy:
> - main: stable branch
> - develop: ongoing work
> - feature/: new features (e.g., feature/user-auth)

## 2. Features to Implement (MVP)

### User Authentication

#### Core Features
1. User registration (email/password)
2. User login
3. Basic profile management
   - Display name
   - Google Calendar linked status

> **[JR DEV TIP]**: Example Firestore Structure:
> ```javascript
> /users/{userId}  // Document ID is the Firebase Auth UID
> {
>   displayName: "Alice Smith",
>   email: "alice@example.com",
>   googleCalendarLinked: true,
>   googleRefreshToken: "ENCRYPTED_TOKEN",
>   memberColors: {
>     "Alice": "#FF0000",
>     "Bob": "#0000FF"
>   }
> }
> ```

### Calendar Views

#### Day View
- Display events (local and Google)
- Show meal plans
- Optimize Firestore queries

> **[JR DEV TIP]**: Use SwiftUI's List or ScrollView with VStack. Fetch data only for the displayed day.

#### Week View
- Event indicators
- Meal plan markers
- Efficient data aggregation

> **[JR DEV TIP]**: 
> - Fetch 7 days of data
> - Show dots/indicators initially
> - Load details on selection

#### Month View
- Monthly overview
- Event and meal plan indicators
- Performance optimization

> **[JR DEV TIP]**: 
> - Use lightweight indicator data
> - Consider LazyVGrid/LazyHGrid
> - Implement efficient data loading

#### Navigation
- Swipe gestures
- Date pickers
- Leverage SwiftUI gestures

### Event Management (Local)

#### Event Creation
- Title
- Date/time
- Location
- Assignee
- Notes
- Color

> **[JR DEV TIP]**: Example Firestore Structure:
> ```javascript
> /events/{eventId}
> {
>   userId: "USER_AUTH_UID",
>   title: "Team Meeting",
>   startTime: Timestamp,
>   endTime: Timestamp,
>   location: "Conference Room B",
>   assignee: "Alice",
>   notes: "Discuss project progress",
>   color: "#FF0000",
>   isGoogleEvent: false
> }
> ```

#### Event Operations
- Editing existing events
- Deleting events
- Firestore operations

### Google Calendar Integration

#### Account Linking
1. UI flow for Google authorization
2. OAuth flow implementation
3. Token management

> **[JR DEV TIP]**: Flow:
> 1. User taps "Link Google Account"
> 2. Google Sign-In screen opens
> 3. User grants permission
> 4. App receives authorization code

#### Backend Implementation
1. Token exchange Cloud Function
2. Secure token storage
3. Event fetching
4. Error handling

> **[JR DEV TIP]**: Critical security notes:
> - Keep client secrets in Cloud Function environment
> - Secure refresh tokens in Firestore
> - Handle all errors gracefully

### Meal Management

#### Meal Library
- Create, view, edit, delete meals
- Store in Firestore
- Ingredient management

> **[JR DEV TIP]**: Example Firestore Structure:
> ```javascript
> /users/{userId}/meals/{mealId}
> {
>   name: "Spaghetti Bolognese",
>   ingredients: ["Pasta", "Ground Beef", "Tomato Sauce", "Onion"]
> }
> ```

#### Ingredient Tracking
- Global ingredients collection
- Boolean needed field
- Duplicate handling

> **[JR DEV TIP]**: Example Firestore Structure:
> ```javascript
> /users/{userId}/ingredients/{ingredientId}
> {
>   name: "Ground Beef",
>   needed: false
> }
> ```

#### Meal Planning
- Browse meal library
- Select meals for specific times
- Link to Firestore

> **[JR DEV TIP]**: Example Firestore Structure:
> ```javascript
> /users/{userId}/mealPlans/{YYYY-MM-DD}
> {
>   date: Timestamp,
>   breakfastMealId: "MEAL_ID_123",
>   lunchMealRef: DocumentReference,
>   dinnerMealId: "MEAL_ID_789"
> }
> ```

## 3. Future Features (Post-MVP)

### Chore Chart
- Descriptions
- Assignees
- Due dates
- Completion status

### Custom Lists
- Tasks
- Groceries
- Completion tracking

### Weather Integration
- API integration via Cloud Functions
- Secure key management

### Access Sharing
- Permission levels
- Shared calendars
- Meal plans
- Lists

### Advanced Calendar Features
- Write operations via backend
- Multiple calendar support
- Sync configuration

### UI Enhancements
- Customized views
- User preferences
- Sleep mode
- Font sizing

### Enhanced Meal Planning
- Frequently used meals
- ML-based suggestions
- Intelligent updates
- Quantity tracking
- Delivery integration

## 4. Development Roadmap

### Phase 1: Foundation
1. Setup
   - Xcode project
   - Firebase integration
   - Google Calendar API
2. Authentication
   - Firebase Auth
   - User profiles
3. Backend setup
   - Cloud Functions
   - Firestore structure
4. Basic UI
   - Day view
   - Data display

### Phase 2: Core Features
1. Local calendar
2. Meal management
3. Basic planning
4. Ingredient tracking

### Phase 3: Integration
1. Real-time sync
2. Color coding
3. Google Calendar

### Phase 4: Enhancement
1. Meal-ingredient connection
2. Advanced planning
3. UI polish

### Phase 5: Future Features
- Implement based on priority
- Maintain security
- Scale carefully

## 5. Technical Specifications

### Platforms
- iOS
- iPadOS

### Architecture
- SwiftUI UI
- Firestore backend
- Cloud Functions
- Google Calendar API

### Security
- OAuth 2.0
- Firebase Rules
- Secure storage
- API protection

### Performance
- Query optimization
- Data modeling
- Caching strategy

## 6. Learning Resources

### Apple Development
- Swift documentation
- SwiftUI tutorials
- Xcode guides

### Firebase
- Firestore guides
- Cloud Functions
- Authentication
- Security Rules

### Google Cloud
- API documentation
- OAuth guides
- Best practices

### Additional Resources
- Online courses
- Community forums
- Developer blogs

## 7. Next Steps

1. Environment Setup
2. Basic Authentication
3. Google Integration
4. Core Features
5. Testing & Refinement

> **[JR DEV TIP]**: Take it step by step. Focus on getting each component working before moving to the next. Test thoroughly and don't hesitate to ask for help when needed.

# FamilyCalendar Setup and Usage Instructions

## Firebase Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Add an iOS app to your Firebase project
3. Download the GoogleService-Info.plist file
4. Add the file to your Xcode project
5. Enable Authentication and Firestore in the Firebase Console

## Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isFamilyMember(familyId) {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/families/$(familyId)) &&
        get(/databases/$(database)/documents/families/$(familyId)).data.members.hasAny([{'userId': request.auth.uid}]);
    }
    
    // User profiles
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }
    
    // Family documents
    match /families/{familyId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && 
        request.resource.data.members[0].userId == request.auth.uid &&
        request.resource.data.members[0].role == 'owner';
      allow update: if isFamilyMember(familyId);
      allow delete: if isFamilyMember(familyId);
    }
  }
}
```

## Family Creation Process
1. User must be signed in
2. Call `createFamily(name: String)` on FamilyViewModel
3. The function will:
   - Create a new family document using `addDocument`
   - Set the current user as the owner
   - Update local state with the new family
4. The family document structure:
   ```json
   {
     "name": "Family Name",
     "creatorId": "user_id",
     "members": [
       {
         "userId": "user_id",
         "role": "owner"
       }
     ],
     "createdAt": "timestamp"
   }
   ```

## Error Handling
- If family creation fails, check:
  1. User is properly authenticated
  2. Security rules are correctly configured
  3. Network connection is available
  4. Firebase project is properly set up

## Testing
1. Test family creation with a new user
2. Verify the family document is created in Firestore
3. Check that the user is set as the owner
4. Verify local state is updated correctly

## Troubleshooting
1. If you get "Missing or insufficient permissions":
   - Check that the user is signed in
   - Verify the security rules are properly deployed
   - Ensure the family document structure matches the rules
2. If family creation fails:
   - Check the Firebase Console logs
   - Verify the user's authentication status
   - Ensure all required fields are present

## Best Practices
1. Always use `addDocument` for creating new family documents
2. Keep the member data structure simple and consistent
3. Update local state only after successful document creation
4. Implement proper error handling and user feedback
5. Test thoroughly with different user scenarios



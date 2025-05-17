# Next Steps for FamilyCalendar

## Critical Bugs to Fix
1. Fix CoreGraphics NaN errors
   - Enable CG_NUMERICS_SHOW_BACKTRACE to get detailed stack traces
   - Review all view layouts for potential NaN calculations
   - Check all geometry calculations in:
     - DayScheduleView (likely culprit due to time-based positioning)
     - EventCard layouts
     - MealView layouts
   - Add validation for all numeric inputs used in view layouts
   - Add default values to prevent NaN propagation

2. Resolve Firebase Permission Issues
   - Fix AppCheck configuration:
     - Update DeviceCheck provider configuration
     - Add fallback for unsupported platforms
     - Configure proper debug tokens
   - Review and update Firestore security rules:
     - Check rules for 'families' collection access
     - Verify user authentication checks
     - Add proper role-based access control
   - Add error handling for permission failures:
     - Implement retry logic
     - Show user-friendly error messages
     - Add offline support/caching

## High Priority
1. Firebase Configuration
   - Implement proper AppCheck setup for development
   - Configure DeviceCheck provider correctly
   - Add proper error handling for AppCheck failures
   - Test and verify Firestore permissions

2. View Layout Fixes
   - Audit all view layouts for potential NaN issues
   - Add validation for time-based calculations
   - Implement proper layout bounds checking
   - Add default values for edge cases

3. Error Handling Improvements
   - Add comprehensive error handling for Firebase operations
   - Implement proper UI feedback for errors
   - Add retry mechanisms for failed operations
   - Implement offline support

4. Implement event editing functionality
   - Add edit button to EventCard and EventView
   - Create EditEventView with pre-filled fields
   - Update Firebase documents on edit

5. Implement event deletion
   - Add delete button with confirmation
   - Handle Firebase document deletion
   - Update UI to reflect changes

6. Implement meal editing and deletion
   - Add edit/delete buttons to MealView
   - Create EditMealView
   - Handle Firebase updates and deletions

7. Test and fix Google Calendar integration
   - Test sync functionality
   - Handle authorization edge cases
   - Implement conflict resolution

## Medium Priority
1. Enhance real-time updates
   - Implement Firestore listeners for all relevant collections
   - Add loading states and error handling
   - Optimize performance

2. Improve color coding system
   - Add color picker for events
   - Implement color themes
   - Add accessibility considerations

3. Add shopping list generation
   - Create ShoppingListView
   - Aggregate ingredients from meal plans
   - Add manual item addition
   - Implement list sharing

## Low Priority
1. Add calendar sharing features
   - Implement invite system
   - Handle permissions
   - Add shared calendar view

2. Implement push notifications
   - Configure Firebase Cloud Messaging
   - Add notification preferences
   - Implement local notifications

3. Add data export/import
   - Export calendar data
   - Export meal plans
   - Import from other calendar systems

## Technical Debt
1. Improve error handling
   - Add consistent error types
   - Implement better error messages
   - Add error recovery options

2. Enhance testing
   - Add unit tests
   - Add UI tests
   - Set up CI/CD

3. Code cleanup
   - Review and update documentation
   - Optimize database queries
   - Remove unused code

## Today's Progress (March 19, 2024)

### Completed Setup
1. ✅ Created Xcode project and organized file structure
2. ✅ Added Firebase SDK using Swift Package Manager
3. ✅ Set up Firebase project and downloaded configuration
4. ✅ Created Google Cloud project and configured OAuth
5. ✅ Set up GitHub repository with:
   - Proper .gitignore for sensitive files
   - MIT LICENSE
   - Comprehensive README
   - Templates for configuration files
6. ✅ Organized project structure with Models, Views, and ViewModels

## Immediate Next Steps

### 1. Initial App Testing
Once simulator download completes:
- Launch app in simulator
- Check Xcode console for Firebase initialization messages
- Verify AuthenticationView appears correctly
- Look for any immediate build errors or warnings

### 2. Authentication Testing
Test the following flows:
1. Email/Password Registration:
   - Open app to AuthenticationView
   - Navigate to registration
   - Test form validation
   - Create test account
   - Verify Firebase Auth creation

2. Email/Password Login:
   - Test with created account
   - Verify error messages
   - Check login state persistence

3. Google Sign-In:
   - Test OAuth flow
   - Verify permissions request
   - Check Google Calendar access

### 3. Calendar Integration
After authentication is working:
1. Test Google Calendar API:
   - Verify API access
   - Test calendar listing
   - Check event fetching

2. Implement Core Calendar Features:
   - Event creation
   - Event viewing
   - Basic synchronization

### 4. Data Model Testing
Verify all models work with Firebase:
1. Event Model:
   - Create test events
   - Verify Firestore storage
   - Test real-time updates

2. Meal Model:
   - Create test meals
   - Link to calendar events
   - Test meal planning features

3. FamilyMember Model:
   - Create family members
   - Test permissions
   - Verify member management

## Immediate Actions
1. Configure Firebase App Check
   - Go to Firebase Console > App Check
   - Enable App Check for the iOS app
   - Enable Debug Provider for development
   - Copy and save the debug token
   - Test app with new App Check configuration

2. Verify Meal Storage
   - Test meal creation after App Check is configured
   - Verify meals are being saved to correct Firestore path
   - Check Firestore Console to confirm data structure

3. Debug Meal Assignment
   - Test meal assignment functionality
   - Monitor Xcode console for any error messages
   - Verify meal plans are being created in Firestore

## Future Enhancements

### Phase 2 Preparation
1. Local Calendar Management:
   - Implement offline support
   - Add local caching
   - Sync queue for offline changes

2. Meal Planning:
   - Enhanced meal creation
   - Recipe integration
   - Shopping list generation

### Phase 3 Planning
1. Real-time Features:
   - Family member location sharing
   - Event notifications
   - Calendar sharing improvements

## Development Guidelines

### Testing Approach
1. Start with unit tests for models
2. Add UI tests for critical flows
3. Test on multiple iOS versions
4. Verify iPad layout

### Code Quality
1. Run SwiftLint regularly
2. Follow SwiftUI best practices
3. Document all major components
4. Keep STATUS.md updated

### Security Considerations
1. Never commit sensitive files:
   - GoogleService-Info.plist
   - Info.plist with credentials
2. Regular security review of:
   - Authentication flows
   - Data access rules
   - API usage

## Resources
- [Firebase iOS Documentation](https://firebase.google.com/docs/ios/setup)
- [Google Calendar API Guide](https://developers.google.com/calendar/api/guides/overview)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)

## Notes
- Keep checking STATUS.md for detailed progress tracking
- Refer to instructions.md for high-level project overview
- Update this file as new steps are identified
- Document any blockers or issues in GitHub Issues 

## Future Improvements
1. Add Error Handling
   - Implement user-friendly error messages
   - Add retry mechanisms for failed operations
   - Improve error logging

2. Enhance User Experience
   - Add loading indicators during Firestore operations
   - Implement proper feedback for successful operations
   - Add confirmation dialogs for important actions

3. Data Validation
   - Add input validation for meal creation
   - Implement date range validation for meal assignments
   - Add checks for duplicate meal assignments 

# Next Steps

## High Priority
1. Complete MealView implementation
   - Test template loading
   - Add error handling for missing templates
   - Consider caching frequently accessed templates

2. Verify Actor Isolation
   - Test all async operations in view models
   - Ensure UI updates happen on main thread
   - Validate Firebase operations with concurrent access

3. Test Family Member Management
   - Verify new member creation with correct roles
   - Test member list updates
   - Add member deletion functionality

## Medium Priority
1. Improve Schedule View
   - Add time-based positioning for events/meals
   - Implement drag-and-drop for scheduling
   - Add visual indicators for conflicts

2. Enhance Error Handling
   - Add user-friendly error messages
   - Implement retry mechanisms for failed operations
   - Add offline support/caching

3. Add Data Validation
   - Validate meal assignments before saving
   - Check for scheduling conflicts
   - Verify family member permissions

## Future Enhancements
1. Add meal template management
   - CRUD operations for templates
   - Template categories/tags
   - Template sharing between families

2. Implement notifications
   - Meal reminders
   - Assignment notifications
   - Family updates

3. Add analytics and insights
   - Meal frequency tracking
   - Family participation metrics
   - Popular meal tracking 
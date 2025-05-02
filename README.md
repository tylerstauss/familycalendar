# FamilyCalendar iOS App

A comprehensive family calendar application that helps families manage events, meals, and schedules together.

## Features

- 📅 Calendar views (Day, Week, Month)
- 🍽️ Meal planning
- 👨‍👩‍👧‍👦 Family member management
- 🔄 Google Calendar integration
- 🔐 Secure authentication
- 📱 iOS native app using SwiftUI

## Prerequisites

- Xcode 15.0+
- iOS 15.0+
- Swift 5.5+
- A Google Cloud project with Calendar API enabled
- Firebase project

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/tylerstauss/familycalendar.git
   cd familycalendar
   ```

2. **Firebase Setup**
   - Create a new project in [Firebase Console](https://console.firebase.google.com)
   - Add an iOS app to your Firebase project
   - Download `GoogleService-Info.plist`
   - Place it in the `FamilyCalendar/FamilyCalendar` directory

3. **Google Cloud Setup**
   - Enable Google Calendar API in your Google Cloud project
   - Configure OAuth consent screen
   - Create iOS OAuth credentials
   - Copy your OAuth client ID

4. **Configure Info.plist**
   - Copy `Info.plist.template` to `Info.plist` in the `FamilyCalendar/FamilyCalendar` directory
   - Replace placeholder values:
     - `YOUR-CLIENT-ID` with your OAuth client ID
     - `YOUR-REVERSED-CLIENT-ID` with the reversed client ID format

5. **Open in Xcode**
   - Open `FamilyCalendar.xcodeproj`
   - Wait for Swift Package Manager to resolve dependencies
   - Build and run the project

## ⚠️ Important: Sensitive Files

The following files contain sensitive information and are not included in the repository:

1. `GoogleService-Info.plist`: Contains Firebase configuration
2. `Info.plist`: Contains OAuth credentials

These files must be created locally following the setup instructions above. Templates and examples are provided:
- Use `Info.plist.template` as a reference for creating your `Info.plist`

## Project Structure

```
FamilyCalendar/
├── Models/
│   ├── Event.swift
│   ├── Meal.swift
│   └── FamilyMember.swift
├── ViewModels/
│   ├── DayViewModel.swift
│   ├── WeekViewModel.swift
│   ├── MonthViewModel.swift
│   └── ProfileViewModel.swift
├── Views/
│   ├── Auth/
│   ├── Components/
│   └── [View files]
└── Services/
    └── GoogleCalendarService.swift
```

## Development Status

Check [STATUS.md](STATUS.md) for current development status and upcoming features.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
# SplitPro Release Notes

## v1.0.5 (Build 6) - May 12, 2026

### Light Theme Support
- Added Light, Dark, and System appearance settings
- Migrated shared components, navigation, and major screens to theme-aware colors
- Persisted theme preference across app launches

### Navigation Polish
- Added a dedicated Settings screen under Profile
- Reset Profile tab back to the profile root when leaving Settings
- Removed the Profile/Settings transition animation for an instant switch

### UI Refinements
- Improved primary button text/icon contrast in light mode
- Updated StatusBar styling for light and dark appearances

---

## v1.0.4 (Build 5) — May 11, 2026

### ✨ Auth Screen Redesign
- Completely redesigned **Login** and **Sign Up** screens with premium glassy UI
- Icon-adorned input fields (mail, lock, person, shield icons)
- Logo glow container with subtle violet-tinted border
- Password visibility toggle on all password fields
- "Welcome Back" / "Create Account" section headers inside GlassCard

### 🐛 Keyboard Overlap Fix
- Moved Sign In / Create Account buttons to a **sticky footer** outside the ScrollView
- Buttons now stay visible above the keyboard at all times
- Matches the same proven pattern used in the Add Expense screen
- Added `flex: 1` to ScrollView to properly constrain layout
- Uses full keyboard height for headerless screens (vs 85% for screens with headers)

### 🔒 Logout Permission Error Fix
- Fixed `firestore/permission-denied` error appearing after logout
- Auth state is now cleared **before** `signOut()` so screens unmount and Firestore listeners detach before the auth token is revoked
- Added 500ms delay between state clear and sign-out to give React time to process unmounts
- Downgraded all `onSnapshot` error handlers from `console.error` to `console.warn` to prevent red LogBox errors during logout transitions

---

## v1.0.3 (Build 4)

- Premium Glassy UI redesign across all screens
- Obsidian dark theme with violet accent palette
- GlassCard, GlassBalanceCard, GlassHeader components
- Push notification support
- Group management improvements

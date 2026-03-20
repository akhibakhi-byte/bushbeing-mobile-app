# bushbeing - Indoor Plant Management App

## Overview
bushbeing is a native mobile app built with Expo (React Native) for indoor plant management. The app connects to an existing deployed FastAPI backend for all data operations.

**Tagline:** "Nurture your indoor garden with intelligent plant care"

## Tech Stack
- **Frontend:** Expo SDK 54, React Native, expo-router (file-based routing)
- **Backend:** External deployed FastAPI at `https://plant-care-dev.preview.emergentagent.com/api`
- **Auth:** JWT tokens stored in expo-secure-store
- **Images:** expo-image-picker (camera + gallery), stored as base64

## Design System
- **Theme:** Dark mode only
- **Primary:** Emerald green `#10B981`
- **Background:** `#1A1A1A` / Cards: `#262626`
- **Fonts:** System fonts (no custom fonts)
- **Buttons:** Pill-shaped with glow shadow
- **Cards:** Rounded corners, subtle border

## Screens
1. **Auth** - Login/Register with OTP verification, password strength indicator, forgot password
2. **My Plants** (Tab 1) - 2-column plant card grid, room filter pills, water toggle, FAB to add
3. **Hydrate** (Tab 2) - Watering progress bar, date timeline, plant watering list
4. **Nurture** (Tab 3) - Garden stats, health cards with scores, care tips grid
5. **Devices** (Tab 4) - Coming soon screen with "Meet Dew" and survey button
6. **Plant Detail** - Hero image, care guide, quick actions, health journal
7. **Add Plant** - Multi-step: photo upload → identification → results → save

## File Structure
```
frontend/
  app/
    _layout.tsx          - Root layout with AuthProvider
    index.tsx            - Entry redirect (auth check)
    auth.tsx             - Login/Register/OTP/Forgot Password
    (tabs)/
      _layout.tsx        - Bottom tab navigation
      index.tsx          - My Plants home
      hydrate.tsx        - Watering tracker
      nurture.tsx        - Plant health overview
      devices.tsx        - Coming soon
    plant/
      [id].tsx           - Plant detail
      add.tsx            - Add new plant
  src/
    theme.ts             - Design tokens
    api.ts               - API client
    AuthContext.tsx       - Auth state management
```

## API Endpoints Used
- Auth: login, register (OTP), verify OTP, forgot password
- Plants: CRUD, water, water history, identify, identify-multi
- Rooms: CRUD
- Watering Logs: list, delete
- Health Logs: create, list, delete

## Enhancements (v2)
1. Room editing (add/rename/delete) with edit icon on filter bar
2. Plant edit modal shows room pills + manage rooms link
3. Water success/undo toast messages
4. Water sound (expo-av) plays when watering
5. Change password in drawer menu
6. Drawer-style menu (slides from right, dismisses on outside click)
7. Bottom tabs repositioned for better fit
8. Room names centered in pills
9. Register has confirm password field
10. Input validation (email format, required fields, password strength)
11. Password masked by default with toggle
12. Cleaner dashboard header spacing
13. Redesigned camera/upload buttons as cards
14. Push notifications for watering reminders (expo-notifications)

## Status
- Frontend: ✅ Fully built with all 14 enhancements (26/26 tests passed)
- Backend: ✅ Full backend built locally (FastAPI + MongoDB) with all 18+ endpoints
- Auth: ✅ Login, Register with OTP + confirm password, Forgot Password, Change Password
- Plant CRUD: ✅ Create, Read, Update, Delete with room assignment
- PlantNet Integration: ✅ Plant identification via PlantNet API
- Watering: ✅ Water toggle with sound + toast, watering logs, historical watering
- Health Journal: ✅ Create/view/delete health log entries
- Notifications: ✅ Push notifications scheduled for watering reminders
- All UI screens render correctly with proper dark theme and emerald green accent

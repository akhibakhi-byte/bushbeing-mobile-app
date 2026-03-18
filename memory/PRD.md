# bushbeing - Indoor Plant Management App

## Overview
bushbeing is a native mobile app built with Expo (React Native) for indoor plant management. The app connects to an existing deployed FastAPI backend for all data operations.

**Tagline:** "Nurture your indoor garden with intelligent plant care"

## Tech Stack
- **Frontend:** Expo SDK 54, React Native, expo-router (file-based routing)
- **Backend:** External deployed FastAPI at `https://smart-detect-flow.preview.emergentagent.com/api`
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

## Status
- Frontend: ✅ Fully built and functional
- Backend connectivity: ⚠️ External backend temporarily unavailable (404)
- All UI screens render correctly with proper dark theme and emerald green accent

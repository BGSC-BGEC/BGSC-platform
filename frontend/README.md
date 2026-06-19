# Frontend Setup - BGSC Platform

This folder contains the frontend applications for the BGSC platform:
- **mobile/** - React Native app using Expo (iOS/Android)
- **web/** - React web admin console (PWA)
- **shared/** - Shared types, API clients, and utilities

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Expo CLI (for mobile): `npm install -g expo-cli`
- Git

### Setup Instructions

#### 1. Install Dependencies

```bash
# Install shared package
cd frontend/shared
npm install

# Install mobile app
cd ../mobile
npm install

# Install web app
cd ../web
npm install
```

#### 2. Environment Variables

Create `.env.local` files in each app directory:

**mobile/.env.local**
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

**web/.env.local**
```
VITE_API_URL=http://localhost:3000/api
```

#### 3. Start Development Servers

**Mobile App:**
```bash
cd mobile
npm run start
# Then press 'a' for Android, 'i' for iOS
```

**Web Admin:**
```bash
cd web
npm run dev
# Opens at http://localhost:5173
```

## Project Structure

### Shared Package (`shared/`)
Contains common code used by both mobile and web:
- **types/** - TypeScript interfaces and enums
- **api/client.ts** - Axios-based API client with interceptors
- **api/repositories/** - Repository pattern implementations
  - `auth.repository.ts` - Authentication APIs
  - `user.repository.ts` - User management APIs
  - `event.repository.ts` - Event management APIs
  - `sponsor.repository.ts` - Sponsor system APIs
  - `points.repository.ts` - Points/rewards APIs
  - `announcement.repository.ts` - Announcements APIs
  - `hall-of-fame.repository.ts` - Hall of Fame APIs
- **mvvm/base-view-model.ts** - Base ViewModel class
- **constants/** - App-wide constants

### Mobile App (`mobile/`)
React Native app using Expo

**Structure:**
```
src/
├── app.tsx           # Main app with routing & providers
├── stores/           # Zustand stores (auth, theme)
├── screens/          # Screen components (to be built)
├── mvvm/             # ViewModels (to be built)
└── assets/           # Images, fonts, etc.
```

**State Management:**
- `useAuthStore` - Authentication state
- `useThemeStore` - Theme preferences
- React Query - Server state management

### Web Admin (`web/`)
React + Vite + Tailwind CSS admin console

**Structure:**
```
src/
├── App.tsx              # Main routing component
├── pages/               # Page components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── EventManagementPage.tsx
│   ├── AnnouncementPage.tsx
│   └── UsersManagementPage.tsx
├── stores/              # Zustand stores (auth, theme)
├── api/                 # API client configuration
├── components/          # Reusable components (to be built)
├── App.css              # Tailwind styles
└── main.tsx             # Entry point
```

## API Integration

### Authentication Flow

1. User submits login form
2. `AuthRepository.login()` sends credentials to backend
3. Backend returns JWT tokens + user info
4. Tokens stored in secure storage (AsyncStorage/localStorage)
5. Subsequent requests include Bearer token
6. On token expiry, automatic refresh via `onTokenRefresh` callback

### Repository Pattern

All data fetching goes through repositories:

```typescript
// Instead of direct API calls:
const response = await fetch('/api/events');

// Use repositories:
const eventRepo = new EventRepository(apiClient);
const events = await eventRepo.listEvents();
```

## MVVM Pattern

ViewModels in `mvvm/` folders extend `BaseViewModel`:

```typescript
class EventListViewModel extends BaseViewModel<EventListState> {
  // State management with Zustand
  // Business logic and transformations
  // Calls to repositories
}
```

## Development Checklist (June 19-26)

- [x] Project structure created
- [x] Shared package with types, API clients, repositories
- [x] Mobile app skeleton with Expo
- [x] Web admin skeleton with Vite + Tailwind
- [x] State management (Zustand) configured
- [x] Authentication stores created
- [x] Basic routing setup
- [ ] Build and test setup
- [ ] Connect to backend APIs (June 26+)
- [ ] Create UI components and screens (June 27+)

## Common Commands

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm run test

# Build for production
npm run build

# Mobile: Build for Android
cd mobile
eas build --platform android

# Mobile: Build for iOS
cd mobile
eas build --platform ios
```

## Backend API Status

**Ready (Phase 0 - Complete):**
- ✅ `/auth/*` - Authentication endpoints
- ✅ `/users/*` - User management

**Coming (Phase 1 - Due June 26):**
- 🔄 `/events/*` - Event management
- 🔄 `/sponsors/*` - Sponsor system
- 🔄 `/points/*` - Points/rewards
- 🔄 `/announcements/*` - Announcements
- 🔄 `/hall-of-fame/*` - Hall of Fame

**Status:** Check backend README for live API documentation

## Troubleshooting

### Mobile App Issues

**Issue:** Expo app won't start
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### Web App Issues

**Issue:** Vite port already in use
```bash
npm run dev -- --port 5174
```

### API Connection Issues

**Issue:** CORS errors
- Ensure backend is running on correct port (3000)
- Check `REACT_APP_API_URL` / `VITE_API_URL` environment variables

## Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [React Query Docs](https://tanstack.com/query/latest)

---

**Next Steps:**
1. Verify all dependencies install correctly
2. Start backend server (see backend README)
3. Test authentication flow with backend
4. Begin building UI components (Phase 1 starts June 27)

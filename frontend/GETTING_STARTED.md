# Frontend Getting Started Guide

## ✅ Setup Complete!

I've created a complete frontend project structure for BGSC Platform. Here's what's ready:

## 📁 Project Structure

```
frontend/
├── shared/                    # Shared utilities & types
│   ├── src/
│   │   ├── types/            # TypeScript interfaces (User, Event, etc.)
│   │   ├── api/
│   │   │   ├── client.ts     # Axios API client with interceptors
│   │   │   └── repositories/ # Service repositories
│   │   ├── mvvm/             # MVVM base classes
│   │   └── constants/        # App-wide constants
│   └── package.json
│
├── mobile/                    # React Native + Expo app
│   ├── src/
│   │   ├── app.tsx           # Main entry point
│   │   ├── stores/           # Zustand stores
│   │   ├── screens/          # Screen components (to build)
│   │   └── mvvm/             # ViewModels (to build)
│   ├── app.json              # Expo config
│   └── package.json
│
├── web/                       # React + Vite + Tailwind admin
│   ├── src/
│   │   ├── App.tsx           # Main routing
│   │   ├── pages/            # Page components
│   │   ├── stores/           # Zustand stores
│   │   ├── api/              # API client config
│   │   └── index.css         # Tailwind styles
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   └── package.json
│
└── README.md                 # Frontend docs
```

## 🚀 First Steps (June 19-26)

### Step 1: Install Dependencies

```bash
# From project root
cd frontend

# Install all workspaces (shared, mobile, web)
npm install
```

### Step 2: Create Environment Files

**mobile/.env.local**
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

**web/.env.local**
```
VITE_API_URL=http://localhost:3000/api
```

### Step 3: Test Your Setup

**Test Mobile:**
```bash
cd frontend/mobile
npm run start
# Press 'w' to open web preview (easiest to test)
```

**Test Web:**
```bash
cd frontend/web
npm run dev
# Opens at http://localhost:5173
```

If both start without errors, you're ready! ✅

### Step 4: Coordinate with Backend Team

- [ ] Ask backend team for Swagger API documentation link
- [ ] Verify all Phase 1 MVP endpoints will be ready by June 26
- [ ] Test authentication flow once backend is running
- [ ] Check error response format consistency

## 📚 What's Already Built

### Shared Package Features
- ✅ **21 Type Definitions** - User, Event, Sponsor, Points, Announcement, etc.
- ✅ **API Client** - Axios wrapper with automatic token refresh
- ✅ **7 Repositories** - Auth, User, Event, Sponsor, Points, Announcement, HallOfFame
- ✅ **Base ViewModel** - Parent class for all screen logic
- ✅ **App Constants** - Centralized configuration

### Mobile App Features
- ✅ Expo Router navigation setup
- ✅ Zustand auth store with role checking
- ✅ Zustand theme store (light/dark mode)
- ✅ React Query configuration
- ✅ AsyncStorage persistence
- ✅ Base app layout with providers

### Web Admin Features
- ✅ React Router navigation (auth flows)
- ✅ Zustand auth store with role checking
- ✅ Zustand theme store
- ✅ React Query configuration
- ✅ Tailwind CSS ready
- ✅ Placeholder pages (Dashboard, Events, Announcements, Users)
- ✅ Login page template

## 🔄 Data Flow Example

### User Login Flow (Ready to implement June 27+)

```
1. User enters email/password on LoginPage
   ↓
2. Calls AuthRepository.login()
   ↓
3. API Client sends POST /auth/login
   ↓
4. Backend returns { accessToken, refreshToken, user }
   ↓
5. Store tokens in localStorage/AsyncStorage
   ↓
6. Update useAuthStore.setTokens()
   ↓
7. Navigate to dashboard
```

### Fetching Events (Ready to implement June 27+)

```
1. EventListScreen mounts
   ↓
2. useQuery hooks into EventRepository.listEvents()
   ↓
3. React Query handles caching, retries, loading states
   ↓
4. Results auto-update when data refreshes
```

## 🛠️ Architecture Decisions Made

### Why MVVM?
- ✅ Clean separation of concerns
- ✅ Testable business logic
- ✅ Reusable across mobile & web
- ✅ Easy to maintain as features grow

### Why Zustand?
- ✅ Lightweight (no boilerplate)
- ✅ TypeScript first-class support
- ✅ Works on React Native and Web
- ✅ Simple to test

### Why React Query?
- ✅ Handles server state caching
- ✅ Automatic background refetch
- ✅ Built-in error handling
- ✅ Works with React Native

### Why Repository Pattern?
- ✅ Decouples API from UI
- ✅ Easy to mock in tests
- ✅ Reusable across screens
- ✅ Single source of truth for API calls

## 📋 Timeline

| Date | Phase | Task |
|------|-------|------|
| Jun 19-26 | Prep | ✅ Frontend structure ready, wait for backend APIs |
| Jun 27-Jul 10 | Phase 1 | Build auth screens, events, profile (mobile + web) |
| Jul 11-Aug 21 | Phase 2 | Add friends, posts, challenges |
| Aug 22-Oct 16 | Phase 3 | Union page, teams, auctions |

## 🔐 Authentication Flow

The API client automatically handles:

1. **Token Injection** - Adds `Authorization: Bearer {token}` to all requests
2. **Token Refresh** - When 401 received, automatically calls `/auth/refresh`
3. **Retry on Refresh** - Retries the original request after refresh
4. **Error Handling** - Redirects to login on auth failure
5. **Persistent Storage** - Tokens survive app restart

## 📝 Key Files to Know

- **`frontend/shared/src/types/index.ts`** - All type definitions
- **`frontend/shared/src/api/client.ts`** - HTTP client with interceptors
- **`frontend/shared/src/api/repositories/`** - Service classes
- **`frontend/mobile/src/stores/`** - Mobile Zustand stores
- **`frontend/web/src/stores/`** - Web Zustand stores
- **`frontend/*/package.json`** - Dependencies for each app

## ❓ Common Questions

**Q: When do I connect to the backend?**
A: After June 26 when all Phase 1 APIs are ready. For now, focus on UI structure.

**Q: How do I test without backend?**
A: Mock the repositories with test data in your screens.

**Q: Can I reuse code between mobile and web?**
A: Yes! Put all shared logic in ViewModels. UI only goes in screens/pages.

**Q: Where do I add new API calls?**
A: 1. Create repository method in `shared/src/api/repositories/`
   2. Use it in your ViewModel
   3. No changes needed in UI

**Q: How do I debug the API client?**
A: Check browser DevTools → Network tab or React Native Debugger

## 📞 Need Help?

If you get stuck:

1. Check the [Frontend README](./README.md)
2. Review the backend README for API documentation
3. Check Zustand/React Query docs for patterns
4. Test in isolation (build one thing at a time)

## 🎯 Your Action Items (Right Now)

- [ ] Clone and navigate to `frontend/`
- [ ] Run `npm install`
- [ ] Create `.env.local` files (use `.env.example` as template)
- [ ] Test `npm run start` (mobile) and `npm run dev` (web)
- [ ] Ask backend team for Swagger API docs
- [ ] Review backend README to understand the API structure
- [ ] Come back June 27 ready to build screens!

---

**You're all set to start building on June 27!** 🚀

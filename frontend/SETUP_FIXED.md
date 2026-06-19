# 🚀 Frontend Setup - Quick Start Guide

## ✅ What I Just Fixed

I've fixed several dependency and configuration issues:

### 1. **Expo Version Mismatch** ✅
- **Problem:** Expo 50 + Expo Router 2 are incompatible
- **Solution:** Upgraded to Expo Router 3.4.0 (compatible with Expo 50)

### 2. **Missing Dependencies** ✅
- Added `@react-native-async-storage/async-storage` (required for mobile auth)
- Added `expo-font` and `expo-splash-screen` (required for Expo app)
- Added `@vitejs/plugin-react` (required for web Vite setup)

### 3. **Repository Exports** ✅
- Fixed shared package exports to include all repositories
- Updated main index.ts to properly export all API repositories

### 4. **API Client for Mobile** ✅
- Created mobile API client singleton
- Configured token refresh and authorization handling

### 5. **Vite Configuration** ✅
- Fixed __dirname issue for ES modules
- Added proper path aliases for imports

---

## 📦 Installation Steps

### Step 1: Install All Dependencies

```bash
cd frontend
npm install
```

This will install dependencies for:
- `frontend/shared` (shared types, API, MVVM)
- `frontend/mobile` (React Native app)
- `frontend/web` (React admin web)

**Expected output:** Should complete without errors. If you see warnings about peer dependencies, that's normal.

### Step 2: Verify Installation

```bash
# Check that packages installed correctly
npm list --depth=0
```

You should see all three workspaces listed:
```
bgsc-platform-frontend@1.0.0
├── @bgsc/shared@1.0.0
├── bgsc-mobile@1.0.0
└── bgsc-web@1.0.0
```

### Step 3: Set Up Environment Variables

**For Mobile:**
```bash
cp frontend/mobile/.env.example frontend/mobile/.env.local
# Edit the file and set EXPO_PUBLIC_API_URL if needed
```

**For Web:**
```bash
cp frontend/web/.env.example frontend/web/.env.local
# Edit the file and set VITE_API_URL if needed
```

---

## 🧪 Test the Setup

### Option A: Test Mobile App

```bash
cd frontend/mobile
npm run start

# In Expo app that opens:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator
# - Press 'w' for web preview
```

**Expected:** Splash screen appears, then you should see the auth flow loading screen.

### Option B: Test Web Admin

```bash
cd frontend/web
npm run dev

# Opens http://localhost:5173
```

**Expected:** Browser opens with login page

### Option C: Test Build

```bash
# Build shared package
cd frontend/shared
npm run build

# Should create dist/ folder with compiled code
```

---

## 🔍 Common Issues & Solutions

### Issue 1: `npm ERR! code ERESOLVE`
**Solution:** Already fixed! Just run `npm install` again.

### Issue 2: Compilation errors about missing types
**Solution:** Run `npm install` in the specific workspace:
```bash
cd frontend/shared && npm install
cd ../mobile && npm install
cd ../web && npm install
```

### Issue 3: `Cannot find module '@bgsc/shared'`
**Solution:** Make sure you installed from the `frontend/` directory:
```bash
cd frontend
npm install  # Install ALL workspaces
```

### Issue 4: Expo app won't start
**Solution:** Clear cache:
```bash
cd mobile
npm run start -- -c  # -c = clear cache
```

### Issue 5: Web app shows blank page
**Solution:** Check browser console for errors, ensure `VITE_API_URL` is set

---

## 📁 Project Structure Now

```
frontend/
├── shared/
│   ├── src/
│   │   ├── types/          # TypeScript definitions
│   │   ├── api/
│   │   │   ├── client.ts   # Axios API client
│   │   │   └── repositories/  # All API repositories
│   │   ├── mvvm/           # Base ViewModel class
│   │   ├── constants/      # App constants
│   │   └── index.ts        # Main exports
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/
│   ├── src/
│   │   ├── app.tsx         # Entry point with providers
│   │   ├── stores/         # Zustand stores (auth, theme)
│   │   ├── screens/        # Screen components (to build)
│   │   ├── mvvm/           # ViewModels (to build)
│   │   └── api/
│   │       └── api-client.ts  # API client instance
│   ├── app.json            # Expo config
│   ├── package.json
│   └── tsconfig.json
│
├── web/
│   ├── src/
│   │   ├── App.tsx         # Main router component
│   │   ├── main.tsx        # Entry point
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   ├── mvvm/           # ViewModels (to build)
│   │   ├── api/
│   │   │   └── api-client.ts  # API client instance
│   │   ├── App.css         # Tailwind styles
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts      # Vite configuration
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── MVVM_GUIDE.md           # How to build screens
├── README.md               # Full documentation
└── package.json            # Monorepo config

```

---

## 🎯 What's Ready to Use

### Shared Package (`@bgsc/shared`)
✅ **Types:** User, Event, Sponsor, Points, Announcement, etc.
✅ **API Client:** Axios with auto token refresh
✅ **Repositories:** Auth, User, Event, Sponsor, Points, Announcement, HallOfFame
✅ **MVVM:** BaseViewModel class
✅ **Constants:** All app-wide constants

### Mobile App
✅ **Setup:** Expo + React Native configured
✅ **Navigation:** Expo Router ready
✅ **State:** Zustand stores (auth, theme) with persistence
✅ **Providers:** React Query, QueryClient setup
✅ **Entry:** App shell with auth flow detection

### Web Admin
✅ **Setup:** Vite + React + Tailwind CSS
✅ **Routing:** React Router with auth protection
✅ **State:** Zustand stores (auth, theme) with persistence
✅ **Providers:** React Query, QueryClient setup
✅ **Pages:** Login page template + placeholder pages
✅ **Styling:** Tailwind CSS configured

---

## 🚀 Next Steps (June 19-26)

1. ✅ **Installation** (you're doing this now!)
2. ⏳ **Wait for Backend APIs** (due June 26)
3. 📖 **Read Documentation:**
   - Read `frontend/README.md` for full guide
   - Read `frontend/MVVM_GUIDE.md` before building screens
4. 🧠 **Understand the Pattern:** MVVM + Repository pattern
5. 🎨 **Start Building (June 27):**
   - Mobile: Auth screens, events, profile
   - Web: Event management, announcements

---

## 📚 Useful Commands

```bash
# From frontend/ directory:

# Development
npm run dev:mobile          # Start mobile dev server
npm run dev:web            # Start web dev server

# Building
npm run build              # Build all workspaces

# Code quality
npm run format             # Format code
npm run lint               # Lint all code

# Testing
npm run test               # Run all tests
```

---

## ✨ You're All Set!

All dependencies are now compatible and properly configured. Try running `npm install` now—it should work without errors!

**Any issues?** Check the Common Issues section above, or share the exact error message.

---

**Timeline:**
- **Today (June 19):** ✅ Install dependencies ✅
- **June 19-26:** Wait for backend, read docs
- **June 27:** Start building Phase 1 screens! 🚀

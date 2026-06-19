# Developer Reference - MVVM & Repository Pattern

This guide explains how to use the MVVM pattern and Repository pattern when building screens.

## 🏗️ Architecture Pattern

```
┌─────────────────┐
│   UI Components │ (React/React Native components)
│  (View Layer)   │
└────────┬────────┘
         │ observes state + calls actions
         │
┌────────▼────────────────┐
│   ViewModel (Zustand)   │ Business logic, transformations
│  (Presentation Logic)   │
└────────┬────────────────┘
         │ uses
         │
┌────────▼─────────┐
│  Repositories    │ API calls, data fetching
│   (Model Layer)  │
└────────┬─────────┘
         │ uses
         │
┌────────▼──────────┐
│   API Client      │ HTTP requests
│  (HTTP layer)     │
└───────────────────┘
```

## 📱 Example: Building an Events List Screen

### Step 1: Create Repository (Already Done!)

The `EventRepository` already exists in `shared/src/api/repositories/event.repository.ts`:

```typescript
// This already exists, you can use it
const eventRepo = new EventRepository(apiClient);
const events = await eventRepo.listEvents({ status: 'upcoming' }, 1, 20);
```

### Step 2: Create a ViewModel (You Do This)

Create `mobile/src/mvvm/event-list.view-model.ts`:

```typescript
import { create } from 'zustand';
import { EventRepository, Event, PaginatedResponse, BaseViewModel, ViewModelState } from '@bgsc/shared';
import ApiClient from '../api/api-client';

interface EventListState extends ViewModelState {
  events: Event[];
  currentPage: number;
  totalPages: number;
  selectedFilter: 'upcoming' | 'ongoing' | 'past';
}

// Create Zustand store
export const useEventListStore = create<EventListState & {
  setEvents: (events: Event[]) => void;
  setPage: (page: number) => void;
  setFilter: (filter: 'upcoming' | 'ongoing' | 'past') => void;
  fetchEvents: () => Promise<void>;
}>((set, get) => {
  const eventRepo = new EventRepository(apiClient);
  
  return {
    // State
    events: [],
    currentPage: 1,
    totalPages: 1,
    selectedFilter: 'upcoming',
    loading: false,
    error: null,

    // Actions
    setEvents: (events) => set({ events }),
    
    setPage: (page) => set({ currentPage: page }),
    
    setFilter: (filter) => {
      set({ selectedFilter: filter, currentPage: 1 });
      get().fetchEvents(); // Refetch with new filter
    },

    fetchEvents: async () => {
      set({ loading: true, error: null });
      try {
        const result = await eventRepo.listEvents(
          { status: get().selectedFilter },
          get().currentPage,
          20
        );
        set({
          events: result.data,
          totalPages: Math.ceil(result.total / 20),
        });
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },
  };
});
```

### Step 3: Create a Screen Component (You Do This)

Create `mobile/src/screens/EventsScreen.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { View, FlatList, Text, TouchableOpacity } from 'react-native';
import { useEventListStore } from '../mvvm/event-list.view-model';

export default function EventsScreen() {
  const {
    events,
    loading,
    error,
    selectedFilter,
    fetchEvents,
    setFilter,
  } = useEventListStore();

  useEffect(() => {
    fetchEvents();
  }, []);

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      {/* Filter Buttons */}
      <View style={{ flexDirection: 'row' }}>
        {(['upcoming', 'ongoing', 'past'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setFilter(filter)}
            style={{
              padding: 10,
              backgroundColor: selectedFilter === filter ? 'blue' : 'gray',
            }}
          >
            <Text>{filter}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Events List */}
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.title}</Text>
            <Text>{item.description}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

### Step 4: Use in Your App

```typescript
// In your router/navigation
import EventsScreen from './screens/EventsScreen';

<Stack.Screen name="events" component={EventsScreen} />
```

## 🌐 Example: Web Admin Event Management Page

### ViewModel (Works the same way)

```typescript
// web/src/mvvm/event-management.view-model.ts
export const useEventManagementStore = create((set, get) => {
  const eventRepo = new EventRepository(apiClient);
  
  return {
    events: [],
    loading: false,
    error: null,
    
    fetchEvents: async () => {
      // Same pattern as mobile!
    },
    
    createEvent: async (data) => {
      set({ loading: true });
      try {
        await eventRepo.createEvent(data);
        await get().fetchEvents(); // Refetch list
      } catch (error) {
        set({ error: error.message });
      } finally {
        set({ loading: false });
      }
    },
  };
});
```

### Page Component (React instead of React Native)

```typescript
// web/src/pages/EventManagementPage.tsx
import { useEffect } from 'react';
import { useEventManagementStore } from '../mvvm/event-management.view-model';

export default function EventManagementPage() {
  const { events, loading, error, fetchEvents, createEvent } = useEventManagementStore();

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async () => {
    await createEvent({
      title: 'New Event',
      description: 'Description',
      type: 'sports',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      registrationDeadline: new Date().toISOString(),
    });
  };

  return (
    <div className="p-8">
      <button onClick={handleCreateEvent} className="bg-blue-500 text-white px-4 py-2">
        Create Event
      </button>
      
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      <table className="w-full mt-4">
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.title}</td>
              <td>{event.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 🔄 How It All Works Together

### Making an API Call

```
User clicks "Load Events"
    ↓
Screen calls useEventListStore.fetchEvents()
    ↓
ViewModel calls eventRepo.listEvents()
    ↓
Repository calls apiClient.get('/events')
    ↓
API Client adds Authorization header
    ↓
Backend responds with data
    ↓
API Client returns response
    ↓
Repository processes data
    ↓
ViewModel updates Zustand store
    ↓
Screen re-renders with new data
```

## 📦 Adding a New Repository

### 1. Create the repository in `shared/`:

```typescript
// shared/src/api/repositories/challenge.repository.ts
import { BaseRepository } from './base.repository';
import { Challenge } from '../../types';
import ApiClient from '../client';

export class ChallengeRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/challenges');
  }

  async listChallenges(page = 1, limit = 20) {
    return this.getPaginated('/', page, limit);
  }

  async getChallenge(id: string): Promise<Challenge> {
    return this.get<Challenge>(`/${id}`);
  }

  async acceptChallenge(id: string) {
    return this.post(`/${id}/accept`);
  }
}
```

### 2. Use it in your ViewModel:

```typescript
const challengeRepo = new ChallengeRepository(apiClient);
const challenges = await challengeRepo.listChallenges();
```

## 🧪 Testing Your ViewModel

```typescript
// Event: Mock repository
const mockEventRepo = {
  listEvents: jest.fn().mockResolvedValue({
    data: [{ id: '1', title: 'Test Event' }],
    total: 1,
  }),
};

// Test: Call fetchEvents and verify
const store = useEventListStore();
await store.fetchEvents();
expect(store.events).toHaveLength(1);
expect(store.events[0].title).toBe('Test Event');
```

## 💡 Best Practices

### DO:
- ✅ Put API calls in repositories
- ✅ Put business logic in ViewModels
- ✅ Keep components simple (just render state + call actions)
- ✅ Share ViewModels between mobile & web
- ✅ Use React Query for heavy caching needs
- ✅ Handle loading/error states in ViewModel

### DON'T:
- ❌ Make API calls directly from components
- ❌ Put complex logic in components
- ❌ Create multiple repositories for same endpoint
- ❌ Bypass the repository layer
- ❌ Store entire API responses - transform in ViewModel

## 🎯 Quick Summary

1. **Repositories** = API calls (use existing ones or create new ones)
2. **ViewModels** = Business logic + state management (Zustand)
3. **Components** = Display UI + call ViewModel actions
4. **Types** = Use existing types in `shared/src/types/`
5. **Reuse** = Same ViewModel works on mobile & web

---

When you start building screens on June 27, follow this pattern for every feature!

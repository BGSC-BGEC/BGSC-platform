# Points & Challenges — Frontend Implementation Guide

> **Read this alongside** `points-challenge-page.md` (UI/UX spec) and `UI-UX-Master-Doc.md` (design system).
> This doc covers the **code-level** implementation: component tree, state management, API wiring, glassmorphism styles, and the full implementation checklist.

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/points`
**Drill-in:** `/(stack)/challenge/[id]` · `/(stack)/challenge/[id]/submission`
**Auth:** Required — guests are redirected to `/login`, return path preserved.

---

## 1. Component Tree

```
points.tsx  (screen root)
├── DynamicStatusBar                        ← shared component
├── TabBar  [Points | Challenges]           ← local, sticky
│
├── Tab 0 — PointsDashboard
│   └── ScrollView
│       ├── BalanceCard                     ← §4.1 spec
│       ├── HowToEarnSection               ← horizontal ScrollView of EarnTile
│       ├── HowToSpendSection              ← horizontal ScrollView of SpendTile
│       ├── ActiveChallengesStrip          ← conditional, §9.3 spec
│       └── TransactionHistory
│           ├── FilterChipRow              ← single-select chips
│           └── FlatList<TransactionRow>   ← paginated, pull-to-refresh
│
└── Tab 1 — ChallengeBrowser
    ├── StickyFilterBar
    │   ├── DomainChipRow                  ← single-select
    │   └── DifficultyChipRow              ← multi-select
    └── FlatList<ChallengeCard>            ← paginated, pull-to-refresh

--- stack screens ---
challenge/[id].tsx
├── CustomNavBar  [← Back | Title | Share]
└── ScrollView
    ├── PillRow  [domain | difficulty]
    ├── TitleBlock
    ├── DescriptionBody (rich text)
    ├── StatRow  [Team | Time | Points]
    ├── HallOfFameBanner  (Legend only)
    ├── ResourceLinksList
    ├── StatusPill
    └── ActionArea  (auth-only, fixed bottom)
        └── (varies by state — §6.5 spec)

challenge/[id]/submission.tsx
├── CustomNavBar  [← Back | "Submission"]
├── ScrollView
│   ├── ChallengeHeaderInfo
│   ├── StatusPill + DeadlineCountdown
│   ├── ProofUploadGrid
│   │   └── MediaThumbnail[]  + AddButton
│   └── NotesTextArea
└── SubmitButton  (fixed bottom)
```

---

## 2. File Structure to Create

```
mobile/src/
├── app/(drawer)/points.tsx                    ← screen root + tab controller
├── app/(stack)/challenge/[id].tsx             ← challenge detail
├── app/(stack)/challenge/[id]/submission.tsx  ← submission screen
│
├── components/points/
│   ├── BalanceCard.tsx
│   ├── EarnTile.tsx
│   ├── SpendTile.tsx
│   ├── ActiveChallengeStrip.tsx
│   ├── ActiveChallengeCard.tsx
│   ├── TransactionRow.tsx
│   └── FilterChipRow.tsx
│
├── components/challenges/
│   ├── ChallengeCard.tsx
│   ├── DomainChipRow.tsx
│   ├── DifficultyChipRow.tsx
│   ├── ChallengeStatRow.tsx
│   ├── ResourceLinkRow.tsx
│   ├── AcceptChallengeSheet.tsx
│   └── ProofUploadGrid.tsx
│
├── viewmodels/
│   ├── PointsDashboardViewModel.ts
│   ├── ChallengeBrowserViewModel.ts
│   ├── ChallengeDetailViewModel.ts
│   └── SubmissionViewModel.ts
│
└── core/repositories/
    ├── PointsRepository.ts                   ← GET balance, GET transactions
    └── ChallengeRepository.ts                ← list, get, accept, submit
```

---

## 3. ViewModels

### 3.1 PointsDashboardViewModel

```ts
// viewmodels/PointsDashboardViewModel.ts
import { BaseViewModel } from '../core/viewmodel/BaseViewModel';
import { PointsRepository } from '../core/repositories/PointsRepository';
import { Transaction, TransactionFilter } from '../core/types';

interface State {
  balance: number;
  balanceLoading: boolean;
  balanceError: string | null;
  transactions: Transaction[];
  transactionsLoading: boolean;
  transactionsError: string | null;
  filter: TransactionFilter;   // 'all' | 'earned' | 'spent' | 'refunded'
  page: number;
  hasMore: boolean;
  activeChallenges: ActiveChallengeSummary[];
}

export class PointsDashboardViewModel extends BaseViewModel<State> {
  constructor(
    private pointsRepo: PointsRepository,
    private userId: string,
  ) {
    super({
      balance: 0, balanceLoading: true, balanceError: null,
      transactions: [], transactionsLoading: true, transactionsError: null,
      filter: 'all', page: 1, hasMore: true, activeChallenges: [],
    });
  }

  async loadBalance() {
    await this.runAsync('balance', async () => {
      const { balance } = await this.pointsRepo.getBalance(this.userId);
      this.setState({ balance, balanceLoading: false });
    });
  }

  async loadTransactions(reset = false) {
    const page = reset ? 1 : this.state.page;
    await this.runAsync('transactions', async () => {
      const data = await this.pointsRepo.listTransactions(this.userId, {
        filter: this.state.filter,
        page,
        pageSize: 30,
      });
      this.setState({
        transactions: reset ? data.items : [...this.state.transactions, ...data.items],
        page: page + 1,
        hasMore: data.hasMore,
        transactionsLoading: false,
      });
    });
  }

  setFilter(filter: TransactionFilter) {
    this.setState({ filter, page: 1, transactions: [] });
    this.loadTransactions(true);
  }

  loadMore() {
    if (!this.state.hasMore || this.state.transactionsLoading) return;
    this.loadTransactions();
  }

  // Called when FCM push arrives — invalidate and reload
  onPointsUpdated() {
    this.loadBalance();
    this.loadTransactions(true);
  }
}
```

### 3.2 ChallengeBrowserViewModel

```ts
interface BrowserState {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;
  domain: DomainFilter;          // 'all' | 'sports' | 'esports' | 'game_dev' | 'general'
  difficulties: Difficulty[];    // multi-select, default all 4
  page: number;
  hasMore: boolean;
}
// Methods: loadChallenges(reset?), setDomain(d), toggleDifficulty(d), loadMore()
```

### 3.3 ChallengeDetailViewModel

```ts
interface DetailState {
  challenge: ChallengeDetail | null;
  loading: boolean;
  error: string | null;
  userState: ChallengeUserState;  // not_accepted | accepted | submitted | approved | rejected | archived
  accepting: boolean;
  acceptError: string | null;
}
// Methods: load(id), accept(), shareChallenge()
```

### 3.4 SubmissionViewModel

```ts
interface SubmissionState {
  submission: Submission | null;
  loading: boolean;
  proofItems: ProofItem[];       // { type: 'image'|'video'|'link'; uri: string; id: string }
  notes: string;
  submitting: boolean;
  submitError: string | null;
  deadline: Date | null;
}
// Methods: load(challengeId), addProof(item), removeProof(id), setNotes(text), submit(), updateSubmission()
```

---

## 4. API Integration

### 4.1 PointsRepository

```ts
// core/repositories/PointsRepository.ts
export class PointsRepository {
  constructor(private client: ApiClient) {}

  async getBalance(userId: string): Promise<{ userId: string; balance: number }> {
    return this.client.get(`/points/balance/${userId}`);
  }

  async listTransactions(
    userId: string,
    opts: { filter: TransactionFilter; page: number; pageSize: number },
  ): Promise<{ items: Transaction[]; hasMore: boolean }> {
    const params = new URLSearchParams({
      filter: opts.filter,
      page: String(opts.page),
      pageSize: String(opts.pageSize),
    });
    return this.client.get(`/points/transactions/${userId}?${params}`);
  }
}
```

### 4.2 ChallengeRepository

```ts
// core/repositories/ChallengeRepository.ts
export class ChallengeRepository {
  constructor(private client: ApiClient) {}

  async list(filters: ChallengeFilters): Promise<PaginatedResult<Challenge>> {
    return this.client.get(`/challenges?${toParams(filters)}`);
  }

  async get(id: string): Promise<ChallengeDetail> {
    return this.client.get(`/challenges/${id}`);
  }

  async accept(id: string): Promise<void> {
    return this.client.post(`/challenges/${id}/accept`, {});
  }

  async getSubmission(challengeId: string): Promise<Submission | null> {
    return this.client.get(`/challenges/${challengeId}/submission`).catch((e) => {
      if (e.status === 404) return null;
      throw e;
    });
  }

  async submitProof(challengeId: string, dto: SubmitProofDto): Promise<Submission> {
    return this.client.post(`/challenges/${challengeId}/submission`, dto);
  }
}
```

---

## 5. Glassmorphism Styles — This Screen

### 5.1 Balance Card

```tsx
// components/points/BalanceCard.tsx
import { BlurView } from 'expo-blur';
import { useColors } from '../../hooks/use-colors';

export function BalanceCard({ balance, onEarnMore, onGoToStore }) {
  const colors = useColors();
  return (
    <BlurView intensity={60} tint="dark" style={styles.container}>
      {/* Semi-transparent tint overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Your Points</Text>
      <Text style={[styles.balance, { color: colors.accent, fontFamily: 'BebasNeue_400Regular' }]}>
        {balance.toLocaleString()} pts
      </Text>

      <View style={styles.actions}>
        <PillButton variant="outline" label="Earn more ↓" onPress={onEarnMore} />
        <PillButton variant="primary" label="Go to Store →" onPress={onGoToStore} />
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
    padding: 20,
  },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  balance: { fontSize: 48, marginVertical: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
```

### 5.2 Challenge Card

```tsx
// components/challenges/ChallengeCard.tsx
export function ChallengeCard({ challenge, onPress }) {
  const colors = useColors();
  const isInProgress = challenge.userState === 'accepted';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
    >
      <BlurView intensity={55} tint="dark" style={[styles.card, { borderColor: colors.border }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />

        {/* Pills row */}
        <View style={styles.pillRow}>
          <DomainPill domain={challenge.domain} />
          <DifficultyPill difficulty={challenge.difficulty} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {challenge.title}
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
          {challenge.description}
        </Text>

        <Divider />

        {/* Stats */}
        <View style={styles.statsRow}>
          <Text style={[styles.stat, { color: colors.textMuted }]}>
            👥 {challenge.teamLimit === 1 ? 'Solo' : `Up to ${challenge.teamLimit}`}
          </Text>
          <Text style={[styles.stat, { color: colors.textMuted }]}>
            ⏱ {formatTimeLimit(challenge)}
          </Text>
          <Text style={[styles.stat, { color: colors.accent }]}>
            ⭐ +{challenge.awardPoints} pts
          </Text>
        </View>

        {/* Conditional badges */}
        {challenge.difficulty === 'legend' && (
          <Text style={[styles.badge, { color: colors.accent }]}>🏆 Hall of Fame eligible</Text>
        )}
        {isInProgress && (
          <Text style={[styles.badge, { color: colors.success }]}>✅ In Progress</Text>
        )}
      </BlurView>
    </Pressable>
  );
}
```

### 5.3 Accept Challenge Sheet

```tsx
// components/challenges/AcceptChallengeSheet.tsx
// Uses Modal + BlurView as bottom sheet
// BlurView intensity={80} — heavier blur for modal overlay

export function AcceptChallengeSheet({ visible, challenge, onConfirm, onCancel, confirming }) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Scrim */}
      <Pressable style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onCancel} />

      {/* Sheet */}
      <BlurView intensity={80} tint="dark" style={styles.sheet}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Accept Challenge</Text>
          <Pressable onPress={onCancel}>
            <Text style={{ color: colors.textMuted }}>✕</Text>
          </Pressable>
        </View>

        {/* Challenge summary, time reveal (digital), warning (physical), HoF (legend) */}
        <ChallengeSummary challenge={challenge} />

        <View style={styles.actions}>
          <PillButton variant="outline" label="Cancel" onPress={onCancel} />
          <PillButton
            variant="primary"
            label={confirming ? 'Starting…' : 'Confirm — Start →'}
            onPress={onConfirm}
            loading={confirming}
            disabled={confirming}
          />
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden', padding: 20,
    borderWidth: 1, borderBottomWidth: 0,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(142,182,155,0.3)', alignSelf: 'center', marginBottom: 16 },
  scrim: { ...StyleSheet.absoluteFillObject },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
});
```

---

## 6. Skeleton Loading States

Match skeletons to exact content shapes. Use `SkeletonBlock` component.

```tsx
// Balance card skeleton
<SkeletonBlock width="100%" height={120} borderRadius={16} />

// Challenge card skeleton (3 visible)
{[1,2,3].map(i => (
  <View key={i} style={{ gap: 8, padding: 14 }}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <SkeletonBlock width={64} height={22} borderRadius={20} />
      <SkeletonBlock width={56} height={22} borderRadius={20} />
    </View>
    <SkeletonBlock width="80%" height={20} borderRadius={4} />
    <SkeletonBlock width="65%" height={14} borderRadius={4} />
    <SkeletonBlock width="100%" height={1} />
    <SkeletonBlock width="90%" height={14} borderRadius={4} />
  </View>
))}

// Transaction row skeleton (3 rows)
{[1,2,3].map(i => (
  <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14 }}>
    <SkeletonBlock width={36} height={36} borderRadius={18} />
    <View style={{ flex: 1, gap: 6 }}>
      <SkeletonBlock width="70%" height={14} borderRadius={4} />
      <SkeletonBlock width="50%" height={12} borderRadius={4} />
    </View>
    <SkeletonBlock width={48} height={14} borderRadius={4} />
  </View>
))}
```

---

## 7. Countdown Timer Component

Used in submission screen (deadline) and in-progress challenge cards.

```tsx
// components/challenges/CountdownTimer.tsx
import { useEffect, useState } from 'react';

export function CountdownTimer({ deadline, style }) {
  const [remaining, setRemaining] = useState(getRemaining(deadline));
  const colors = useColors();
  const isUrgent = remaining.totalSeconds < 3600; // < 1 hour

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(deadline)), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || remaining.totalSeconds <= 0) return null;
  // Hidden if > 72 hours (per spec §8.1)
  if (remaining.totalSeconds > 72 * 3600) return null;

  const label = remaining.days > 0
    ? `${remaining.days}d ${remaining.hours}h`
    : `${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  return (
    <Text style={[style, { color: isUrgent ? colors.danger : colors.textMuted, fontFamily: 'JetBrainsMono_500Medium', fontSize: 13 }]}>
      ⏱ {label}
    </Text>
  );
}

function getRemaining(deadline: Date) {
  const diff = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
  return {
    totalSeconds: diff,
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  };
}
const pad = (n: number) => String(n).padStart(2, '0');
```

---

## 8. Balance Update Animation

When FCM push arrives and balance changes, animate the number with a scale pop.

```tsx
// Inside BalanceCard — detect balance prop change
const scaleAnim = useRef(new Animated.Value(1)).current;

useEffect(() => {
  Animated.sequence([
    Animated.spring(scaleAnim, { toValue: 1.18, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
  ]).start();
}, [balance]);

// In render:
<Animated.Text style={[styles.balance, { transform: [{ scale: scaleAnim }] }]}>
  {balance.toLocaleString()} pts
</Animated.Text>
```

---

## 9. Empty & Error States

### Empty

```tsx
// Empty challenge browser
<View style={styles.empty}>
  <Text style={{ fontSize: 40 }}>🎮</Text>
  <Text style={[styles.emptyTitle, { color: colors.text }]}>No challenges yet</Text>
  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Check back soon</Text>
</View>

// Empty transaction history
<View style={styles.empty}>
  <Text style={{ fontSize: 36 }}>💰</Text>
  <Text style={[styles.emptyTitle, { color: colors.text }]}>No transactions yet</Text>
  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
    Earn points by joining events or completing challenges.
  </Text>
</View>
```

### Error

```tsx
<View style={styles.error}>
  <Text style={[styles.errorText, { color: colors.textMuted }]}>Could not load data</Text>
  <Pressable onPress={retry}>
    <Text style={[{ color: colors.accent }]}>Retry</Text>
  </Pressable>
</View>
```

---

## 10. Proof Upload — Submission Screen

```tsx
// File validation before upload
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50 MB

async function validateAndAdd(asset: ImagePicker.ImagePickerAsset) {
  const size = asset.fileSize ?? 0;
  const isVideo = asset.type === 'video';
  const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (size > limit) {
    showToast(`File too large. Max ${isVideo ? '50 MB' : '10 MB'}.`);
    return;
  }
  vm.addProof({ type: isVideo ? 'video' : 'image', uri: asset.uri, id: uuid() });
}

// Camera button
async function onCamera() {
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
  if (!result.canceled) await validateAndAdd(result.assets[0]);
}

// Gallery button
async function onGallery() {
  const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images', 'videos'] });
  if (!result.canceled) {
    for (const asset of result.assets) await validateAndAdd(asset);
  }
}

// Link button — simple Alert.prompt or custom modal
function onAddLink() {
  Alert.prompt('Add Link', 'Paste a URL (GitHub, YouTube, etc.)', (url) => {
    if (url?.startsWith('http')) vm.addProof({ type: 'link', uri: url, id: uuid() });
    else if (url) showToast('Please enter a valid URL starting with http');
  });
}
```

---

## 11. Implementation Checklist

### Phase A — Points Dashboard (Tab 0)

- [ ] `BalanceCard` with glassmorphism, Bebas Neue balance number, accent colour
- [ ] `HowToEarnSection` — 4 icon tiles, horizontal scroll, informational only
- [ ] `HowToSpendSection` — 2 icon tiles, horizontal scroll, tap-to-navigate on Store/Leaderboard
- [ ] `ActiveChallengesStrip` — conditional, shows when user has in-progress challenges
- [ ] `FilterChipRow` — All / Earned / Spent / Refunded, single-select
- [ ] `TransactionRow` — icon, description, amount (green/red), timestamp, tap-to-navigate
- [ ] Pagination (30 items, scroll-to-load-more)
- [ ] Pull-to-refresh
- [ ] Skeleton loading for all sections
- [ ] FCM push handler → balance pop animation + toast

### Phase B — Challenge Browser (Tab 1)

- [ ] Sticky `DomainChipRow` (single-select) + `DifficultyChipRow` (multi-select, min 1)
- [ ] `ChallengeCard` with all conditional badges (in-progress, legend HoF)
- [ ] Paginated FlatList with pull-to-refresh
- [ ] Filter re-fetch on chip change
- [ ] Skeleton loading (3 cards)
- [ ] Empty state (filtered + unfiltered)

### Phase C — Challenge Detail Screen

- [ ] Custom nav bar with share icon (native share sheet, deep-link)
- [ ] Full description (rich text render)
- [ ] `StatRow` — team, time (hidden pre-accept for Digital), points
- [ ] Hall of Fame banner (Legend tier only)
- [ ] Resource links list (hidden if none)
- [ ] Status pill
- [ ] `ActionArea` — all 6 user states (§6.5 spec)
- [ ] Guest redirect to `/login`

### Phase D — Accept Challenge Sheet

- [ ] Bottom sheet with glassmorphism (heavy blur)
- [ ] Live time limit fetch for Digital challenges (not from cache)
- [ ] Physical challenge warning
- [ ] Legend HoF notice
- [ ] Confirm → accept API call → update action area → toast
- [ ] In-flight spinner, error toast on failure

### Phase E — Submission Screen

- [ ] Proof upload grid (camera, gallery, link)
- [ ] File size validation (10 MB images, 50 MB videos)
- [ ] Media thumbnail preview + full-screen tap + long-press remove
- [ ] Countdown timer (visible only <72 h, red <1 h)
- [ ] Notes textarea (500-char limit + counter)
- [ ] Submit button disabled until ≥1 proof item
- [ ] Submit confirmation dialog → Under Review state transition
- [ ] All 4 submission states (In Progress, Under Review, Completed, Rejected)

### Phase F — Polish

- [ ] Auth guard — guest to `/login` with return path
- [ ] Balance pop animation on FCM update
- [ ] All error states with retry
- [ ] Accessible `accessibilityRole` + `accessibilityLabel` on all interactive elements
- [ ] Test on Android (BlurView fallback for older devices)
- [ ] Dark mode verification (default)
- [ ] Light mode verification (override)

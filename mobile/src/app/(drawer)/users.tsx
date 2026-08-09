import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import {
  useDebounced,
  useDisableAccount,
  useUpdateUserRole,
  useUsers,
  type UserSortKey,
} from '@/hooks/use-users';

type UserDto = {
  id: string;
  displayName?: string;
  username: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  sponsorName?: string | null;
  pointsBalance: number;
  createdAt: string;
  lastSeen?: string | null;
  avatarUrl?: string | null;
};

const ROLES = ['user', 'member', 'core', 'coordinator', 'founder'] as const;
type RoleKey = (typeof ROLES)[number];

const ROLE_COLORS: Record<RoleKey, { bg: string; text: string }> = {
  user: { bg: 'rgba(10,26,27,0.40)', text: '#8EB69B' },
  member: { bg: 'rgba(91,156,248,0.15)', text: '#5B9CF8' },
  core: { bg: 'rgba(232,102,42,0.15)', text: '#E8662A' },
  coordinator: { bg: 'rgba(245,197,24,0.15)', text: '#F5C518' },
  founder: { bg: 'rgba(52,210,123,0.15)', text: '#34D27B' },
};

const SORT_OPTIONS: { label: string; value: UserSortKey }[] = [
  { label: 'Recent Activity', value: 'last_seen' },
  { label: 'Newest First', value: 'created_at_desc' },
  { label: 'Oldest First', value: 'created_at_asc' },
  { label: 'Most Points', value: 'points' },
  { label: 'Alphabetical', value: 'alpha' },
];

export default function UsersScreen() {
  const myRole = useAuthStore((s) => s.user?.role);
  const authStatus = useAuthStore((s) => s.status);
  const colors = useColors();

  // Hold rendering until the session has resolved so `myRole` is definitive.
  if (authStatus === 'unknown' || authStatus === 'loading') return null;

  // Allow-list: only coordinators and founders may access this screen.
  // The previous guard used `myRole &&` which short-circuited to false when
  // myRole was undefined (unauthenticated), granting access to everyone.
  if (myRole !== 'coordinator' && myRole !== 'founder') {
    router.replace('/(drawer)' as const);
    return null;
  }

  return <UsersDashboard />;
}

function UsersDashboard() {
  const colors = useColors();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<UserSortKey>('last_seen');
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [selected, setSelected] = useState<UserDto | null>(null);
  const [roleSheetUser, setRoleSheetUser] = useState<UserDto | null>(null);

  const debouncedSearch = useDebounced(search);
  const { data, isLoading, isError, isRefetching, refetch } = useUsers({
    search: debouncedSearch,
    role: roleFilter,
    status: statusFilter,
    sort,
  });

  const users = data?.data ?? [];
  const summary = data?.meta.summary;

  const onRefresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            onPress={() => setSelected(item)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelected(item);
            }}
          />
        )}
        ListHeaderComponent={
          <ListHeader
            summary={summary}
            search={search}
            onSearch={setSearch}
            roleFilter={roleFilter}
            onRoleFilter={setRoleFilter}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            sort={sort}
            onSortPress={() => setSortSheetVisible(true)}
            isLoading={isLoading}
            isError={isError}
            isEmpty={users.length === 0}
            onRetry={() => void refetch()}
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
      />

      {/* Sort sheet */}
      <BottomSheet
        visible={sortSheetVisible}
        onClose={() => setSortSheetVisible(false)}
        title="Sort By"
      >
        <View style={styles.sortList}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                setSort(opt.value);
                setSortSheetVisible(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              style={[
                styles.sortRow,
                { borderColor: colors.border },
                sort === opt.value && { backgroundColor: colors.accentMuted },
              ]}
            >
              <Text
                style={[
                  styles.sortLabel,
                  { color: sort === opt.value ? colors.accent : colors.text },
                ]}
              >
                {opt.label}
              </Text>
              {sort === opt.value ? (
                <Ionicons name="checkmark" size={18} color={colors.accent} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      {/* Quick-view sheet */}
      <UserQuickSheet
        user={selected}
        onClose={() => setSelected(null)}
        onChangeRole={(user) => {
          setSelected(null);
          setRoleSheetUser(user);
        }}
      />

      {/* Role management sheet */}
      <RoleSheet
        user={roleSheetUser}
        onClose={() => setRoleSheetUser(null)}
      />
    </View>
  );
}

// ─── List Header ──────────────────────────────────────────────────────────────

function ListHeader({
  summary, search, onSearch, roleFilter, onRoleFilter,
  statusFilter, onStatusFilter, sort, onSortPress,
  isLoading, isError, isEmpty, onRetry,
}: {
  summary?: { total: number; activeThisWeek: number; newThisMonth: number };
  search: string; onSearch: (s: string) => void;
  roleFilter: string | null; onRoleFilter: (r: string | null) => void;
  statusFilter: string | null; onStatusFilter: (s: string | null) => void;
  sort: UserSortKey; onSortPress: () => void;
  isLoading: boolean; isError: boolean; isEmpty: boolean; onRetry: () => void;
}) {
  const colors = useColors();
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort';

  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>USERS</Text>

      {summary ? (
        <GlassCard style={styles.statCard}>
          <Text style={[styles.statText, { color: colors.textMuted }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{summary.total.toLocaleString()}</Text>
            {' '}total  ·  <Text style={[styles.statNum, { color: colors.text }]}>{summary.activeThisWeek.toLocaleString()}</Text>
            {' '}active this week  ·  <Text style={[styles.statNum, { color: colors.success }]}>+{summary.newThisMonth}</Text>
            {' '}this month
          </Text>
        </GlassCard>
      ) : isLoading ? (
        <SkeletonBlock height={52} radius={16} />
      ) : null}

      <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search by name, username, email…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search users"
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => onSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(['all', 'user', 'member', 'core', 'coordinator', 'founder'] as const).map((r) => {
          const active = r === 'all' ? roleFilter === null : roleFilter === r;
          return (
            <Pressable key={r} onPress={() => onRoleFilter(r === 'all' ? null : r)}
              accessibilityRole="button" accessibilityLabel={`Role: ${r}`}
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? colors.accent : 'transparent', borderColor: active ? 'transparent' : colors.border }]}>
              <Text style={[styles.chipLabel, { color: active ? colors.accentText : colors.textMuted }]}>
                {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(['all', 'active', 'suspended', 'pending_deletion'] as const).map((s) => {
          const lbl = s === 'all' ? 'All Statuses' : s === 'pending_deletion' ? 'Pending Delete' : s.charAt(0).toUpperCase() + s.slice(1);
          const active = s === 'all' ? statusFilter === null : statusFilter === s;
          return (
            <Pressable key={s} onPress={() => onStatusFilter(s === 'all' ? null : s)}
              accessibilityRole="button" accessibilityLabel={`Status: ${lbl}`}
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? '#235347' : 'transparent', borderColor: active ? 'transparent' : colors.border }]}>
              <Text style={[styles.chipLabel, { color: active ? colors.text : colors.textMuted }]}>{lbl}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sortBar}>
        <Text style={[styles.sortBarLabel, { color: colors.textMuted }]}>Sort:</Text>
        <Pressable onPress={onSortPress} accessibilityRole="button" accessibilityLabel={`Sort by ${sortLabel}`}
          style={[styles.sortTrigger, { borderColor: colors.border }]}>
          <Text style={[styles.sortTriggerText, { color: colors.text }]}>{sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {isError ? (
        <View style={styles.centred}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Unable to load users.</Text>
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.skelCard, { borderColor: colors.border }]}>
              <SkeletonBlock width={44} height={44} radius={22} />
              <View style={styles.skelBody}>
                <SkeletonBlock width="60%" height={14} radius={6} />
                <SkeletonBlock width="40%" height={12} radius={6} />
                <SkeletonBlock width="75%" height={11} radius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : isEmpty ? (
        <View style={styles.centred}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No users match your filters.</Text>
          <Pressable
            onPress={() => { onSearch(''); onRoleFilter(null); onStatusFilter(null); }}
            hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear filters">
            <Text style={[styles.retryText, { color: colors.accent }]}>Clear Filters</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user, onPress, onLongPress }: { user: UserDto; onPress: () => void; onLongPress: () => void }) {
  const colors = useColors();
  const roleKey = (user.role as RoleKey) in ROLE_COLORS ? (user.role as RoleKey) : 'user';
  const roleColor = ROLE_COLORS[roleKey];
  const name = user.displayName || user.username;

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`${name}, ${user.role}`} style={styles.userCard}>
      <Pressable onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel="Long press for actions">
        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} contentFit="cover" accessibilityLabel={name} />
            ) : (
              <Text style={[styles.avatarInitial, { color: colors.textMuted }]}>{name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardNameRow}>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.cardUsername, { color: colors.textMuted }]}>@{user.username}</Text>
            </View>
            <View style={styles.cardBadgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
                <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: user.status === 'active' ? colors.success : colors.danger }]} />
            </View>
            {user.sponsorName ? (
              <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {user.sponsorName} · {user.pointsBalance.toLocaleString()} pts
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </GlassCard>
  );
}

// ─── Quick-view Sheet ─────────────────────────────────────────────────────────

function UserQuickSheet({ user, onClose, onChangeRole }: { user: UserDto | null; onClose: () => void; onChangeRole: (u: UserDto) => void }) {
  const colors = useColors();
  const toast = useToast();
  const disableAccount = useDisableAccount();
  if (!user) return null;
  const name = user.displayName || user.username;

  const onDisable = () => {
    Alert.alert('Disable Account', `Disable ${name}'s account? They will be unable to log in until re-enabled.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: () => {
        disableAccount.mutate(user.id, {
          onSuccess: () => { onClose(); toast.show('Account disabled.'); },
          onError: () => toast.show('Could not disable account.'),
        });
      }},
    ]);
  };

  return (
    <BottomSheet visible={user !== null} onClose={onClose} title={name}>
      <View style={styles.sheetSection}>
        <Text style={[styles.sheetLabel, { color: colors.textMuted }]}>CONTACT</Text>
        <Text style={[styles.sheetValue, { color: colors.text }]}>{user.email}</Text>
      </View>
      <View style={styles.sheetActions}>
        <PillButton label="View Full Profile" variant="ghost" onPress={() => { onClose(); router.push('/(drawer)/profile'); }} accessibilityLabel="View full profile" />
        <PillButton label="Change Role" variant="ghost" onPress={() => onChangeRole(user)} accessibilityLabel="Change role" />
        <PillButton label="Disable Account" variant="destructive" loading={disableAccount.isPending} onPress={onDisable} accessibilityLabel="Disable account" />
      </View>
    </BottomSheet>
  );
}

// ─── Role Sheet ───────────────────────────────────────────────────────────────

function RoleSheet({ user, onClose }: { user: UserDto | null; onClose: () => void }) {
  const colors = useColors();
  const toast = useToast();
  const updateRole = useUpdateUserRole();
  const [picked, setPicked] = useState<string | null>(null);
  if (!user) return null;
  const name = user.displayName || user.username;
  const canPick = picked !== null && picked !== user.role;

  return (
    <BottomSheet visible={user !== null} onClose={onClose} title={`Change Role — ${name}`}>
      <Text style={[styles.sheetLabel, { color: colors.textMuted }]}>Current: {user.role}</Text>
      <View style={styles.roleList}>
        {ROLES.map((r) => {
          const isActive = (picked ?? user.role) === r;
          const rc = ROLE_COLORS[r];
          return (
            <Pressable key={r} onPress={() => setPicked(r)}
              accessibilityRole="radio" accessibilityLabel={r} accessibilityState={{ checked: isActive }}
              style={[styles.roleRow, { borderColor: colors.border }, isActive && { backgroundColor: colors.accentMuted }]}>
              <View style={[styles.radio, { borderColor: isActive ? colors.accent : colors.border }, isActive && { backgroundColor: colors.accent }]} />
              <Text style={[styles.roleRowName, { color: rc.text, flex: 1 }]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
              {r === user.role ? <Text style={[styles.currentBadge, { color: colors.textMuted }]}>Current</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.roleWarning, { color: colors.textMuted }]}>Role changes take effect immediately. The user will be notified.</Text>
      <PillButton label="Confirm Change" variant="primary" disabled={!canPick} loading={updateRole.isPending}
        onPress={() => {
          if (!canPick || !picked) return;
          updateRole.mutate({ userId: user.id, role: picked }, {
            onSuccess: () => { onClose(); toast.show(`${name} is now ${picked}.`); },
            onError: () => toast.show('Failed to update role.'),
          });
        }}
        accessibilityLabel="Confirm role change" />
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: 8 },
  title: { fontFamily: FONTS.hero, fontSize: 48, letterSpacing: 1.5 },
  statCard: {},
  statText: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 20 },
  statNum: { fontFamily: FONTS.mono, fontSize: 13 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, height: 48 },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 14, paddingVertical: 0 },
  chipRow: { gap: 8, paddingRight: 16 },
  chip: { height: 36, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontFamily: FONTS.semibold, fontSize: 12 },
  sortBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortBarLabel: { fontFamily: FONTS.semibold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  sortTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  sortTriggerText: { fontFamily: FONTS.semibold, fontSize: 12 },
  sortList: { gap: 4, paddingBottom: 8 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1 },
  sortLabel: { fontFamily: FONTS.semibold, fontSize: 14 },
  centred: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
  retryText: { fontFamily: FONTS.semibold, fontSize: 14 },
  skeletonList: { gap: 8 },
  skelCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  skelBody: { flex: 1, gap: 6 },
  userCard: { marginHorizontal: 16, marginBottom: 8 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarInitial: { fontFamily: FONTS.heading, fontSize: 18 },
  cardBody: { flex: 1, gap: 4 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontFamily: FONTS.heading, fontSize: 16 },
  cardUsername: { fontFamily: FONTS.body, fontSize: 13 },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontFamily: FONTS.semibold, fontSize: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardMeta: { fontFamily: FONTS.body, fontSize: 12 },
  sheetSection: { gap: 4, marginBottom: 16 },
  sheetLabel: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  sheetValue: { fontFamily: FONTS.mono, fontSize: 13 },
  sheetActions: { gap: 10 },
  roleList: { gap: 6, marginVertical: 12 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  roleRowName: { fontFamily: FONTS.semibold, fontSize: 14 },
  currentBadge: { fontFamily: FONTS.body, fontSize: 12 },
  roleWarning: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginBottom: 12 },
});
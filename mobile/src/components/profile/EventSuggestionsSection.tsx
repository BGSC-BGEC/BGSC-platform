import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { EventSuggestion } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#3b82f6',
  ongoing: '#22c55e',
  past: '#8c857a',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function EventSuggestionsSection() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  const { data: suggestions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['eventSuggestions'],
    queryFn: UserRepository.getEventSuggestions,
    enabled: status === 'authenticated',
  });

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>📅 Event Suggestions</Text>
        <Pressable onPress={() => router.push('/events')}>
          <Text style={[s.seeAll, { color: colors.accent }]}>See All →</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <FlatList
          horizontal
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          renderItem={() => (
            <View style={s.skeletonCard}>
              <SkeletonBox width="100%" height={90} borderRadius={10} style={{ marginBottom: 8 }} />
              <SkeletonBox width="80%" height={14} style={{ marginBottom: 6 }} />
              <SkeletonBox width="50%" height={12} />
            </View>
          )}
        />
      ) : error ? (
        <View style={s.stateBox}>
          <Text style={[s.stateText, { color: colors.textMuted }]}>Couldn't load suggestions</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[s.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </View>
      ) : suggestions.length === 0 ? (
        <View style={s.stateBox}>
          <Text style={[s.stateText, { color: colors.textMuted }]}>No upcoming events match your interests</Text>
          <Pressable onPress={() => router.push('/events')}>
            <Text style={[s.retryText, { color: colors.accent }]}>Browse all events</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          horizontal
          data={suggestions}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => <EventCard item={item} colors={colors} />}
        />
      )}
    </View>
  );
}

function EventCard({ item, colors }: { item: EventSuggestion; colors: ReturnType<typeof useColors> }) {
  const statusColor = STATUS_COLORS[item.status] ?? colors.textMuted;

  return (
    <Pressable
      style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/event/${item.id}`)}
    >
      {/* Cover placeholder */}
      <View style={[s.cardCover, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <View style={s.cardBody}>
        <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[s.cardDate, { color: colors.textMuted }]}>{fmtDate(item.startDate)}</Text>

        {item.registrationStatus === 'open' && (
          <Pressable
            style={[s.registerBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/event/${item.id}`)}
          >
            <Text style={[s.registerBtnText, { color: colors.primaryText }]}>Register</Text>
          </Pressable>
        )}

        {item.userTeam && item.userTeam.openSlots > 0 && (
          <View style={[s.teamRow, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
            <Text style={[s.teamName, { color: colors.accent }]}>👥 {item.userTeam.teamName}</Text>
            <Text style={[s.teamSlots, { color: colors.textMuted }]}>
              Looking for {item.userTeam.openSlots} more
            </Text>
            <View style={s.teamBtnRow}>
              <Pressable
                style={[s.teamBtn, { backgroundColor: colors.primary }]}
                onPress={() => Alert.alert('Invite', `Share code: ${item.userTeam!.inviteCode}`)}
              >
                <Text style={[s.teamBtnText, { color: colors.primaryText }]}>Invite</Text>
              </Pressable>
              <Pressable
                style={[s.teamBtn, { borderWidth: 1, borderColor: colors.border }]}
                onPress={() => router.push(`/event/${item.id}`)}
              >
                <Text style={[s.teamBtnText, { color: colors.text }]}>Manage</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },

  listContent: { paddingHorizontal: 16, gap: 12 },

  card: { width: 200, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  cardCover: { height: 90, width: '100%', justifyContent: 'flex-end', padding: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start' },
  cardBody: { padding: 10, gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  cardDate: { fontSize: 11 },

  registerBtn: { borderRadius: 999, paddingVertical: 6, alignItems: 'center', marginTop: 4 },
  registerBtnText: { fontSize: 12, fontWeight: '600' },

  teamRow: { borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 4 },
  teamName: { fontSize: 12, fontWeight: '600' },
  teamSlots: { fontSize: 11, marginTop: 2 },
  teamBtnRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  teamBtn: { flex: 1, borderRadius: 999, paddingVertical: 5, alignItems: 'center' },
  teamBtnText: { fontSize: 11, fontWeight: '600' },

  skeletonCard: { width: 200 },

  stateBox: { paddingHorizontal: 16, gap: 6 },
  stateText: { fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: '600' },
});

import { router, useLocalSearchParams } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { EventRepository } from '@/core/repositories/EventRepository';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isCoordinatorPlus =
    user?.role === 'core' || user?.role === 'coordinator' || user?.role === 'founder';

  const { data: event, isPending, isError, refetch } = useQuery({
    queryKey: ['events', id],
    queryFn: () => EventRepository.getById(id),
    enabled: !!id,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {isPending ? 'Bracket' : `${event?.title ?? 'Event'} — Bracket`}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>

        {/* Coordinator redirect */}
        {isCoordinatorPlus && (
          <View style={[styles.adminBanner, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
            <Text style={[styles.adminBannerText, { color: colors.accent }]}>
              Bracket editing is on the Web Console
            </Text>
            <Text style={[styles.adminBannerSub, { color: colors.accent }]}>
              Manage on Web →
            </Text>
          </View>
        )}

        {isPending ? (
          <View style={styles.skeletonGroup}>
            <SkeletonBox width="100%" height={40} borderRadius={10} />
            <View style={styles.bracketRow}>
              <SkeletonBox width="44%" height={80} borderRadius={10} />
              <SkeletonBox width="44%" height={80} borderRadius={10} />
            </View>
            <View style={styles.bracketRow}>
              <SkeletonBox width="44%" height={80} borderRadius={10} />
              <SkeletonBox width="44%" height={80} borderRadius={10} />
            </View>
            <SkeletonBox width="50%" height={80} borderRadius={10} style={{ alignSelf: 'center' }} />
          </View>
        ) : isError || !event ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              Could not load bracket
            </Text>
            <Pressable
              style={[styles.retryBtn, { borderColor: colors.border }]}
              onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Event info chip row */}
            <View style={styles.chipRow}>
              <View style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textMuted }]}>
                  {event.type === 'ALL' ? 'Auction League' : 'Direct League'}
                </Text>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textMuted }]}>
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </Text>
              </View>
            </View>

            {/* Bracket canvas placeholder */}
            <View
              style={[styles.bracketCanvas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.bracketPlaceholderEmoji}>🗂</Text>
              <Text style={[styles.bracketPlaceholderTitle, { color: colors.text }]}>
                Bracket not generated yet
              </Text>
              <Text style={[styles.bracketPlaceholderSub, { color: colors.textMuted }]}>
                The bracket will appear here once coordinators set it up on the Web Console.
                Tap any match node to see venue, rosters, and live scores.
              </Text>
              <Pressable
                style={[styles.retryBtn, { borderColor: colors.border }]}
                onPress={() => refetch()}>
                <Text style={[styles.retryText, { color: colors.accent }]}>Refresh</Text>
              </Pressable>
            </View>

            {/* Round Robin placeholder section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MATCHES</Text>
            <View
              style={[styles.emptyMatches, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyMatchText, { color: colors.textMuted }]}>
                No matches scheduled yet
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backIcon: { fontSize: 22, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  content: { padding: 16, gap: 14 },

  adminBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  adminBannerText: { fontSize: 14, fontWeight: '600' },
  adminBannerSub: { fontSize: 13, fontWeight: '700' },

  skeletonGroup: { gap: 12 },
  bracketRow: { flexDirection: 'row', justifyContent: 'space-between' },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '500' },

  bracketCanvas: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    minHeight: 200,
    justifyContent: 'center',
  },
  bracketPlaceholderEmoji: { fontSize: 48 },
  bracketPlaceholderTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  bracketPlaceholderSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyMatches: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyMatchText: { fontSize: 14 },

  emptyEmoji: { fontSize: 40 },
  stateText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: '600' },
});

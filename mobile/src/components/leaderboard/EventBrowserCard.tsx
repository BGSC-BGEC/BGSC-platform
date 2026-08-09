import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { LiveDot } from '@/components/events/EventCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import type { EventStatus, LeaderboardEntry, PlatformEvent } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { formatEventRange } from '@/lib/dates';

import { displayName } from './StandingsPodium';

export interface EventBrowserCardProps {
  event: PlatformEvent;
  /** Top-3 preview rows — undefined while the per-event leaderboard loads. */
  preview?: LeaderboardEntry[];
  previewLoading: boolean;
  /** The authenticated user's own entry in this event (null = not a participant). */
  myEntry?: LeaderboardEntry | null;
  onPress: () => void;
}

/**
 * Leaderboard event card (leaderboard.md §3.3): status pill, type badge +
 * meta row, top-3 podium preview, "Your Rank" footer (participants only) or
 * [ View → ]. Tap → select event + slide to Standings.
 *
 * TODO(Phase 2): participant counts + min-participant threshold aren't in
 * event-service's EventResponseDto yet — the count is derived from the
 * standings preview and the threshold-locked variant (§3.3) is skipped until
 * `participant_count` / `min_participant_threshold` ship.
 */
export function EventBrowserCard({
  event,
  preview,
  previewLoading,
  myEntry,
  onPress,
}: EventBrowserCardProps) {
  const colors = useColors();

  const participants = preview?.length;

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`Open standings for ${event.title}`} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        <StatusPill status={event.status} />
      </View>
      <View style={styles.metaRow}>
        <View style={[styles.typeBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.typeBadgeText, { color: colors.textMuted }]}>{event.type}</Text>
        </View>
        <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
          {participants != null ? `${participants} participants` : ''}
          {event.startDate ? ` · ${formatEventRange(event.startDate, event.endDate)}` : ''}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {previewLoading ? (
        <View style={styles.previewSkeleton}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} height={16} style={{ marginBottom: 8 }} />
          ))}
        </View>
      ) : preview && preview.length > 0 ? (
        <View>
          {preview.slice(0, 3).map((entry) => (
            <View key={entry.userId} style={styles.previewRow}>
              <Text style={[styles.previewRank, { color: colors.textMuted }]}>{entry.rank}</Text>
              <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
                {displayName(entry.userId)}
              </Text>
              <Text style={[styles.previewScore, { color: colors.text }]}>
                {entry.score.toLocaleString()} pts
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.noScores, { color: colors.textMuted }]}>
          No scores yet — results land once the event starts.
        </Text>
      )}

      <View style={styles.footerRow}>
        {myEntry ? (
          <Text style={[styles.yourRank, { color: colors.text }]} numberOfLines={1}>
            Your Rank: <Text style={{ color: colors.accent }}>#{myEntry.rank}</Text> ·{' '}
            {myEntry.score.toLocaleString()} pts
          </Text>
        ) : (
          <Text style={[styles.yourRank, { color: colors.textMuted }]}>Live standings</Text>
        )}
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`View standings for ${event.title}`}
          hitSlop={8}
          style={styles.viewButton}
        >
          <Text style={[styles.viewText, { color: colors.text }]}>View →</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

/** Status pill per spec §3.3: ● LIVE / ○ UPCOMING / ✓ ENDED. */
function StatusPill({ status }: { status: EventStatus }) {
  const colors = useColors();
  const live = status === 'ongoing';
  return (
    <View
      style={[
        styles.statusPill,
        live
          ? { backgroundColor: colors.surfaceMuted }
          : { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      {live ? (
        <LiveDot size={8} />
      ) : (
        <Ionicons
          name={status === 'upcoming' ? 'ellipse-outline' : 'checkmark-circle-outline'}
          size={12}
          color={colors.textMuted}
        />
      )}
      <Text style={[styles.statusText, { color: live ? colors.success : colors.textMuted }]}>
        {live ? 'LIVE' : status === 'upcoming' ? 'UPCOMING' : 'ENDED'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    borderRadius: 6,
    height: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  metaText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 26,
  },
  previewRank: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    width: 20,
    fontVariant: ['tabular-nums'],
  },
  previewName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    flex: 1,
  },
  previewScore: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  previewSkeleton: {
    paddingVertical: 4,
  },
  noScores: {
    fontFamily: FONTS.body,
    fontSize: 13,
    paddingVertical: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  yourRank: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  viewButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  viewText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 24,
  },
  statusText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});

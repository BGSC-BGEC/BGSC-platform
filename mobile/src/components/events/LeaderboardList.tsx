import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { EmptyState, ErrorState, SectionLabel } from '@/components/events/SectionStates';
import { LiveDot } from '@/components/events/EventCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useEventLeaderboard } from '@/hooks/use-events';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Event leaderboard (spec §7.7): ranked list, top-3 rows get the live pulse
 * blob. `LeaderboardEntry` carries only userId — names resolve via a future
 * user-service join.
 * TODO(events, Phase 2): backend leaderboard entries have no display name;
 * render userId short-form until user-service is joined (or LE scores ship
 * with names).
 */
export function LeaderboardList({ eventId }: { eventId: string }) {
  const colors = useColors();
  const { data: entries, isLoading, isError, refetch } = useEventLeaderboard(eventId);

  return (
    <View style={styles.wrap}>
      <SectionLabel label="LEADERBOARD" />
      {isLoading ? (
        <GlassCard>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} height={28} style={{ marginBottom: 8 }} />
          ))}
        </GlassCard>
      ) : isError ? (
        <GlassCard>
          <ErrorState message="Couldn't load the leaderboard." onRetry={() => void refetch()} />
        </GlassCard>
      ) : !entries || entries.length === 0 ? (
        <GlassCard>
          <EmptyState message="No scores yet — results land after the event starts." />
        </GlassCard>
      ) : (
        <GlassCard>
          {entries.map((entry) => (
            <View key={entry.userId} style={styles.row}>
              <Text style={[styles.rank, { color: colors.text }]}>{entry.rank}</Text>
              {entry.rank <= 3 ? <LiveDot size={8} /> : <View style={styles.dotSpacer} />}
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {entry.userId.slice(0, 8)}
              </Text>
              <Text style={[styles.score, { color: colors.success }]}>{entry.score}</Text>
            </View>
          ))}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  rank: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    width: 22,
  },
  dotSpacer: {
    width: 8,
    height: 8,
  },
  name: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    flex: 1,
  },
  score: {
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
});

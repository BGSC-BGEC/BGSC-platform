import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { EmptyState, ErrorState } from '@/components/events/SectionStates';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import type { PlatformEvent } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { formatDateTime } from '@/lib/dates';

/**
 * Auction spectator view (spec §9) — general spectators only; no bidding
 * controls on mobile. Auction data (on-the-block panel, bid log, captain
 * wallets) has no backend endpoint yet (ALL is Phase 3), so the states
 * matrix's Not Started / Ended states are what we render.
 *
 * TODO(events, Phase 3): wire bid log + captain wallets when the auction
 * service ships; until then "Auction begins at …" is the honest default.
 */
export function AuctionView({
  event,
  isLoading,
  isError,
  onRetry,
}: {
  event?: PlatformEvent;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const colors = useColors();

  if (isLoading || !event) {
    return (
      <View style={styles.gap}>
        <GlassCard style={styles.block}>
          <SkeletonBlock height={120} radius={12} />
        </GlassCard>
        <GlassCard>
          <SkeletonBlock height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock height={14} width="60%" />
        </GlassCard>
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Couldn't load the auction." onRetry={onRetry} />;
  }

  return (
    <View style={styles.gap}>
      <GlassCard style={styles.block}>
        <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
        {event.status === 'past' ? (
          <EmptyState message="Auction ended — final rosters are locked in." />
        ) : (
          <EmptyState message={`Auction begins at ${formatDateTime(event.startDate)}.`} />
        )}
      </GlassCard>
      {event.status === 'past' ? (
        <View style={styles.linkWrap}>
          <Text
            accessibilityRole="link"
            accessibilityLabel="View full results"
            onPress={() => router.push(`/event/${event.id}`)}
            style={[styles.link, { color: colors.accent }]}
          >
            View Full Results →
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: 12,
  },
  block: {
    gap: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  linkWrap: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});

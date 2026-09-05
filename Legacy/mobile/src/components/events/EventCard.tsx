import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import type { PlatformEvent } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { formatEventRange } from '@/lib/dates';

const ESPORTS_TAGS = [
  'esports',
  'valorant',
  'cs2',
  'counter-strike',
  'tekken',
  'minecraft',
  'gaming',
  'bgmi',
  'dota',
  'league of legends',
  'fifa',
  'rocket league',
];

function isEsports(event: PlatformEvent): boolean {
  return event.tags.some((t) => ESPORTS_TAGS.includes(t.toLowerCase()));
}

/** Live pulse blob (spec §10.4) — continuous low-amplitude pulse, native driver. */
export function LiveDot({ size = 10, color }: { size?: number; color?: string }) {
  const colors = useColors();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? colors.success,
        opacity: pulse,
      }}
    />
  );
}

/** Small tertiary chip (spec §6.2 Sponsored Ribbon). */
function SponsoredRibbon() {
  const colors = useColors();
  return (
    <View style={[styles.ribbon, { backgroundColor: colors.surfaceSolid }]}>
      <Text style={[styles.ribbonText, { color: colors.textMuted }]}>SPONSORED</Text>
    </View>
  );
}

/** Single-column event card — BGEC / FitSoc / General standard cards (spec §4.2/§5.2/§6.2). */
export function EventCard({
  event,
  onPress,
  onStravaPress,
}: {
  event: PlatformEvent;
  onPress: () => void;
  /** Scrolls the current tab to the Strava sub-section (spec §5.2). */
  onStravaPress?: () => void;
}) {
  const colors = useColors();
  const subtitle = `${formatEventRange(event.startDate, event.endDate)}${
    event.venue ? ` · ${event.venue}` : ''
  }`;

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`Open ${event.title}`} style={styles.cardRadius}>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        {event.isSponsored ? <SponsoredRibbon /> : event.status === 'ongoing' ? <LiveDot /> : null}
      </View>
      <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
        {event.status === 'ongoing' ? 'Ongoing · ' : ''}
        {subtitle}
      </Text>
      {event.linkedToStrava && onStravaPress ? (
        <Pressable
          onPress={onStravaPress}
          accessibilityRole="button"
          accessibilityLabel="View in Strava"
          hitSlop={8}
          style={[styles.stravaChip, { borderColor: colors.accent }]}
        >
          <Ionicons name="arrow-down" size={12} color={colors.accent} />
          <Text style={[styles.stravaChipText, { color: colors.accent }]}>View in Strava</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

/** Two-column league card (spec §3.2) — Sports/Esports badge, auction tag, live dot. */
export function LeagueCard({ event, onPress }: { event: PlatformEvent; onPress: () => void }) {
  const colors = useColors();
  const esports = isEsports(event);

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`Open league ${event.title}`} style={[styles.league, styles.cardRadius]}>
      <View style={styles.rowBetween}>
        <View style={[styles.typeBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons
            name={esports ? 'game-controller-outline' : 'trophy-outline'}
            size={12}
            color={colors.textMuted}
          />
          <Text style={[styles.typeBadgeText, { color: colors.textMuted }]}>
            {esports ? 'Esports' : 'Sports'}
          </Text>
        </View>
        {event.status === 'ongoing' ? <LiveDot /> : null}
      </View>
      <Text style={[styles.leagueTitle, { color: colors.text }]} numberOfLines={2}>
        {event.title}
      </Text>
      <View style={styles.leagueFooter}>
        {event.isAuctionBased ? (
          <View style={[styles.auctionTag, { backgroundColor: colors.accentMuted }]}>
            <Text style={[styles.auctionTagText, { color: colors.accent }]}>AUCTION</Text>
          </View>
        ) : null}
        <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {formatEventRange(event.startDate, event.endDate)}
        </Text>
      </View>
    </GlassCard>
  );
}

/** Skeleton card matching the event-card shape. */
export function EventCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.skeleton, { borderColor: colors.border }]}>
      <View style={styles.rowBetween}>
        <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: 22, height: 10 }]} />
      </View>
      <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '45%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    flex: 1,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
  },
  ribbon: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ribbonText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  stravaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 32,
  },
  stravaChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  league: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48.5%',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  leagueTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  leagueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  auctionTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  auctionTagText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cardRadius: {
    borderRadius: 24,
  },
  skeleton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
});

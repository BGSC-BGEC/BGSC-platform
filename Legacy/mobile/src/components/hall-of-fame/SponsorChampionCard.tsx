import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import type { HallOfFameSponsorChampion } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

interface SponsorChampionCardProps {
  champion: HallOfFameSponsorChampion;
}

/**
 * Top sponsor card (hall-of-fame spec §5.4.1): logo, name, rank, total fan
 * count as a hero number, events won + affiliated fans.
 *
 * TODO(Phase 2): tenure period (e.g. "Spring 2024 – Fall 2024") — the
 * sponsor-champions DTO has no semester/year range; render once added.
 */
export function SponsorChampionCard({ champion }: SponsorChampionCardProps) {
  const colors = useColors();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.topRow}>
        {champion.logoUrl ? (
          <Image source={{ uri: champion.logoUrl }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={[styles.logoFallback, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.logoInitial, { color: colors.textMuted }]}>
              {champion.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[styles.rankBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.rankText, { color: colors.textMuted }]}>#{champion.rank}</Text>
        </View>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {champion.name}
      </Text>
      <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
        <Ionicons name="medal-outline" size={12} color={colors.accent} />
        <Text style={[styles.badgeText, { color: colors.accent }]}>CHAMPION</Text>
      </View>
      <Text style={[styles.fans, { color: colors.accent }]}>
        {champion.totalFans.toLocaleString('en-IN')}
      </Text>
      <Text style={[styles.fansLabel, { color: colors.textMuted }]}>total fans</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {champion.eventsWonCount} events won · {champion.affiliatedUserCount} affiliated fans
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  rankBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rankText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  name: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  fans: {
    fontFamily: FONTS.hero,
    fontSize: 34,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  fansLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  meta: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import type { HallOfFameSponsorChampion, SponsorStats } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

export interface SponsorStandingCardProps {
  sponsor: HallOfFameSponsorChampion;
  /** Only set on the user's own sponsor (guest / no affiliation → undefined). */
  mine?: SponsorStats | null;
  onVisit: () => void;
  onChangeSponsor?: () => void;
}

/**
 * Sponsor standing card (leaderboard.md §5.4): 48 dp logo tile, rank + name,
 * stat lines, [ ★ YOURS ] badge + fan contribution row + [ Change Sponsor ]
 * on the user's own card. Guests see cards minus the affiliation chrome.
 *
 * TODO(Phase 2): Visit opens the sponsor site via expo-web-browser once
 * sponsor-service exposes a website URL (the champions DTO has none), and
 * Change Sponsor (once per semester) needs a sponsor-service endpoint.
 */
export function SponsorStandingCard({
  sponsor,
  mine,
  onVisit,
  onChangeSponsor,
}: SponsorStandingCardProps) {
  const colors = useColors();
  const isMine = !!mine;

  return (
    <GlassCard accessibilityLabel={`${sponsor.rank}. ${sponsor.name}, ${sponsor.totalFans} fans`}>
      <View style={styles.topRow}>
        <View style={[styles.logo, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.logoText, { color: colors.text }]}>
            {initials(sponsor.name)}
          </Text>
        </View>
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            <Text style={{ color: colors.textMuted }}>{sponsor.rank}. </Text>
            {sponsor.name}
          </Text>
          <Text style={[styles.stats, { color: colors.textMuted }]}>
            {sponsor.totalFans.toLocaleString()} fans · {sponsor.eventsWonCount} events won
          </Text>
          <Text style={[styles.stats, { color: colors.textMuted }]}>
            {sponsor.affiliatedUserCount.toLocaleString()} affiliated users
          </Text>
        </View>
        {isMine ? (
          <View style={[styles.yours, { backgroundColor: colors.background }]}>
            <Text style={[styles.yoursText, { color: colors.accent }]}>★ YOURS</Text>
          </View>
        ) : null}
      </View>

      {isMine && mine ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.contribution, { color: colors.text }]}>
            You have earned {mine.fansContributed.toLocaleString()} fans for {sponsor.name}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onVisit}
              accessibilityRole="button"
              accessibilityLabel={`Visit ${sponsor.name} website`}
              style={[styles.actionButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>Visit ↗</Text>
            </Pressable>
            <Pressable
              onPress={onChangeSponsor}
              accessibilityRole="button"
              accessibilityLabel="Change sponsor"
              style={[styles.actionButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>Change Sponsor</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={onVisit}
            accessibilityRole="button"
            accessibilityLabel={`Visit ${sponsor.name} website`}
            style={[styles.actionButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>Visit ↗</Text>
          </Pressable>
        </View>
      )}
    </GlassCard>
  );
}

function initials(name: string): string {
  // M-28: guard against empty string — w[0] on an empty split segment returns
  // undefined which stringifies to 'undefined'. Filter empty segments first.
  if (!name.trim()) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
  },
  stats: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  yours: {
    borderRadius: 16,
    height: 24,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yoursText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  contribution: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
});

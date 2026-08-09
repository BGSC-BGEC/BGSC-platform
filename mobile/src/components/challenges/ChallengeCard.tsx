import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { DifficultyPill, DomainPill } from '@/components/challenges/Pills';
import { FONTS } from '@/core/theme/fonts';
import type { Challenge } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

import { fmtTimeLimit } from './format';

export interface ChallengeCardProps {
  challenge: Challenge;
}

/**
 * Challenge card (points spec §5.2): domain/difficulty pills, 2-line title
 * and description, stats row (team · time · award), legend Hall-of-Fame
 * badge and ✅ In Progress badge. Tap → challenge detail.
 */
export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const colors = useColors();
  const isInProgress = challenge.userState === 'accepted';

  return (
    <GlassCard
      onPress={() => router.push(`/challenge/${challenge.id}`)}
      accessibilityLabel={`Open challenge ${challenge.title}`}
    >
      <View style={styles.pillRow}>
        <DomainPill domain={challenge.domain} />
        <DifficultyPill difficulty={challenge.difficulty} />
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {challenge.title}
      </Text>
      <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
        {challenge.description}
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.statsRow}>
        <Text style={[styles.stat, { color: colors.textMuted }]}>
          👥 {challenge.teamLimit === 1 ? 'Solo' : `Up to ${challenge.teamLimit}`}
        </Text>
        <Text style={[styles.stat, { color: colors.textMuted }]}>
          ⏱ {fmtTimeLimit(challenge)}
        </Text>
        <Text style={[styles.stat, { color: colors.accent }]}>
          ⭐ +{challenge.awardPoints} pts
        </Text>
      </View>
      {challenge.hallOfFameEligible && (
        <Text style={[styles.badge, { color: colors.accent }]}>
          🏆 Hall of Fame eligible
        </Text>
      )}
      {isInProgress && (
        <Text style={[styles.badge, { color: colors.accent }]}>✅ In Progress</Text>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stat: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  badge: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    marginTop: 8,
  },
});

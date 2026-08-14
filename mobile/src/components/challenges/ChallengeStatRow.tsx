import { StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import type { Challenge } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

import { fmtTimeLimit } from './format';

export interface ChallengeStatRowProps {
  challenge: Challenge;
}

/**
 * Stat row (points spec §6.3): three evenly spaced blocks — Team · Time ·
 * Award. Time shows "Revealed on accept" for digital challenges pre-accept.
 */
export function ChallengeStatRow({ challenge }: ChallengeStatRowProps) {
  const colors = useColors();
  const stats = [
    { label: 'Team', value: challenge.teamLimit === 1 ? 'Solo' : `Up to ${challenge.teamLimit}` },
    { label: 'Time', value: fmtTimeLimit(challenge) },
    { label: 'Award', value: `+${challenge.awardPoints} pts` },
  ];
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View key={s.label} style={styles.block}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{s.label.toUpperCase()}</Text>
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  block: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  value: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});

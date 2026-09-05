import { StyleSheet, Text, View } from 'react-native';

import { DIFFICULTY_COLORS, DOMAIN_COLORS } from '@/core/theme/tokens';
import { FONTS } from '@/core/theme/fonts';
import type { ChallengeDifficulty, ChallengeDomain, ChallengeStatus } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

import { capitalize } from './format';

function Pill({ color, label }: { color: string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[styles.label, { color: colors.accentText }]}>{label}</Text>
    </View>
  );
}

/** Coloured domain capsule (points spec §5.2). */
export function DomainPill({ domain }: { domain: ChallengeDomain }) {
  return <Pill color={DOMAIN_COLORS[domain]} label={capitalize(domain)} />;
}

/** Coloured difficulty capsule (points spec §5.1 / §5.2). */
export function DifficultyPill({ difficulty }: { difficulty: ChallengeDifficulty }) {
  return <Pill color={DIFFICULTY_COLORS[difficulty]} label={capitalize(difficulty)} />;
}

/** Challenge status pill: Active (green fill) / Completed / Archived (muted). */
export function StatusPill({ status }: { status: ChallengeStatus }) {
  const colors = useColors();
  const label = capitalize(status);
  if (status === 'active') {
    return <Pill color={colors.success} label={label} />;
  }
  return (
    <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

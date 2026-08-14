import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import type { LeaderboardEntry } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

import { displayName } from './StandingsPodium';

export interface StandingsRowProps {
  entry: LeaderboardEntry;
  /** Authenticated user's own row → surfaceMuted bg + accent left bar (spec §4.3). */
  isSelf?: boolean;
  onPress?: () => void;
}

/**
 * Standings table row (leaderboard.md §4.3): rank · avatar+name · score.
 * Rows 4+ only — the top 3 live in the podium. Format-specific stat columns
 * (P/W, bracket, fails) and the Δ column are Phase 2: LeaderboardEntry has no
 * such fields yet. TODO(Phase 2): render per-format columns + rank delta from
 * a future standings DTO (leaderboard.md §4.2).
 */
export function StandingsRow({ entry, isSelf = false, onPress }: StandingsRowProps) {
  const colors = useColors();

  const content = (
    <>
      {isSelf ? <View style={[styles.accentBar, { backgroundColor: colors.accent }]} /> : null}
      <Text style={[styles.rank, { color: colors.textMuted }]}>{entry.rank}</Text>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.avatarText, { color: colors.text }]}>{initials(entry.userId)}</Text>
      </View>
      <Text
        style={[styles.name, { color: colors.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {displayName(entry.userId)}
      </Text>
      <Text style={[styles.score, { color: colors.text }]}>{entry.score.toLocaleString()}</Text>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${entry.rank}, ${displayName(entry.userId)}, ${entry.score} points`}
      style={[
        styles.row,
        isSelf && { backgroundColor: colors.surfaceMuted },
        { borderBottomColor: colors.border },
      ]}
    >
      {content}
    </Pressable>
  );
}

function initials(userId: string): string {
  return userId.slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 56,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 56,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  rank: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    width: 32,
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
  },
  name: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    flex: 1,
  },
  score: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    width: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});

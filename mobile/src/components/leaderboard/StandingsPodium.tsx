import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import type { LeaderboardEntry } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

/**
 * Top-3 podium (leaderboard.md §4.3) — the screen's visual hero (master §9).
 * Columns render in visual order 2 · 1 · 3; rank 1 sits 16 dp taller.
 * Staggered entry: translateY 12→0 + opacity 0→1, 0/60/120 ms delays.
 *
 * Medallion fills derive from tokens (no medal colours exist in tokens.ts) —
 * rank 1 accent, rank 2 text, rank 3 textMuted. Rank is never color-only:
 * numerals always present. TODO(design): add rankGold/Silver/Bronze tokens
 * to core/theme/tokens.ts if the spec palette (#F5C518/#C7CBD1/#D9A066) is wanted.
 */
export function StandingsPodium({ entries }: { entries: LeaderboardEntry[] }) {
  const colors = useColors();
  const top = entries.slice(0, 3);
  const order = [1, 0, 2]; // 2nd · 1st · 3rd
  const medallion = [colors.accent, colors.text, colors.textMuted];

  const ordered = order.map((i) => top[i]).filter(Boolean) as LeaderboardEntry[];

  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="Top three standings">
      {ordered.map((entry, slot) => {
        const isFirst = entry.rank === 1;
        return (
          <PodiumTile
            key={entry.userId}
            entry={entry}
            slot={slot}
            isFirst={isFirst}
            medallionColor={medallion[entry.rank - 1] ?? colors.textMuted}
          />
        );
      })}
    </View>
  );
}

function PodiumTile({
  entry,
  slot,
  isFirst,
  medallionColor,
}: {
  entry: LeaderboardEntry;
  slot: number;
  isFirst: boolean;
  medallionColor: string;
}) {
  const colors = useColors();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.spring(progress, {
        toValue: 1,
        stiffness: 340,
        damping: 32,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    }, slot * 60);
    return () => clearTimeout(timer);
  }, [progress, slot]);

  return (
    <Animated.View
      style={[
        styles.animWrap,
        {
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          opacity: progress,
        },
      ]}
    >
      <GlassCard style={styles.tile} accessibilityLabel={`Rank ${entry.rank}, ${displayName(entry.userId)}, ${entry.score} points`}>
        <View style={[styles.medallion, { backgroundColor: medallionColor }]}>
          <Text style={[styles.medallionText, { color: colors.background }]}>{entry.rank}</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.avatarText, { color: colors.text }]}>
            {initials(entry.userId)}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {displayName(entry.userId)}
        </Text>
        <Text style={[styles.score, { color: colors.accent }]}>{entry.score.toLocaleString()}</Text>
        {isFirst ? (
          <Ionicons name="trophy" size={14} color={colors.accent} style={styles.trophy} />
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

/**
 * LeaderboardEntry carries only userId (event-service Phase 1). Render a short
 * form + initials until the user-service join ships (mirrors events LeaderboardList).
 * TODO(Phase 2): resolve display names/avatars from the user-service.
 */
export function displayName(userId: string): string {
  return userId.slice(0, 8);
}

function initials(userId: string): string {
  return userId.slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  animWrap: {
    flex: 1,
  },
  tile: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  medallion: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionText: {
    fontFamily: FONTS.heading,
    fontSize: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
  name: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  score: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  trophy: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 14,
  },
});

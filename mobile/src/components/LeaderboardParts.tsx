import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import type { UIThemeColors } from '../theme/colors';
import { Avatar } from './Avatar';
import { formatNumber } from '../utils/format';

export interface RankedRow {
  key: string;
  rank: number | null;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  score: number;
  previousRank?: number | null;
  isMe?: boolean;
}

const MEDAL: Record<1 | 2 | 3, keyof UIThemeColors> = { 1: 'primary', 2: 'textMuted', 3: 'warning' };

/** Top-three podium laid out 2 · 1 · 3 with the winner raised. */
export function Podium({ rows, unit = 'pts' }: { rows: RankedRow[]; unit?: string }) {
  const { colors, shadow } = useTheme();
  const [anims] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  useEffect(() => {
    Animated.stagger(
      60,
      anims.map((a) => Animated.spring(a, { toValue: 1, tension: 90, friction: 14, useNativeDriver: true })),
    ).start();
  }, [anims]);

  if (rows.length === 0) return null;
  const order = [rows[1], rows[0], rows[2]];

  return (
    <View style={styles.podium}>
      {order.map((row, column) => {
        if (!row) return <View key={`empty-${column}`} style={styles.podiumTile} />;
        const place = (column === 1 ? 1 : column === 0 ? 2 : 3) as 1 | 2 | 3;
        const anim = anims[place - 1];
        return (
          <Animated.View
            key={row.key}
            style={[
              styles.podiumTile,
              { marginTop: place === 1 ? 0 : 16 },
              { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
            ]}
          >
            <View
              style={[
                styles.podiumCard,
                { backgroundColor: colors.surface, borderColor: row.isMe ? colors.accent : colors.border },
                shadow('flat'),
              ]}
            >
              <View style={[styles.medal, { backgroundColor: colors[MEDAL[place]] }]}>
                <Typography variant="labelSmall" color="primaryText">{place}</Typography>
              </View>
              <Avatar name={row.name} uri={row.avatarUrl} size={place === 1 ? 52 : 44} />
              <Typography variant="h4" align="center" numberOfLines={1} style={styles.podiumName}>
                {row.name}
              </Typography>
              <Typography variant="mono" color="accent">
                {formatNumber(row.score)} {unit}
              </Typography>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** One standings row (rank, avatar, name, movement, score); highlighted for the signed-in member. */
export function StandingRow({ row, onPress, unit = 'pts' }: { row: RankedRow; onPress?: () => void; unit?: string }) {
  const { colors } = useTheme();
  const delta = row.rank != null && row.previousRank != null ? row.previousRank - row.rank : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border },
        row.isMe && { backgroundColor: colors.surfaceHighlight, borderLeftColor: colors.accent, borderLeftWidth: 3 },
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Rank ${row.rank ?? 'unranked'}, ${row.name}, ${row.score} ${unit}`}
    >
      <Typography variant="mono" color={row.isMe ? 'accent' : 'textMuted'} style={styles.rank}>
        {row.rank ?? '—'}
      </Typography>
      <Avatar name={row.name} uri={row.avatarUrl} size={32} />
      <View style={styles.identity}>
        <Typography variant="body" numberOfLines={1}>
          {row.name}
          {row.isMe ? ' (you)' : ''}
        </Typography>
        {row.subtitle ? (
          <Typography variant="caption" color="textMuted" numberOfLines={1}>
            {row.subtitle}
          </Typography>
        ) : null}
      </View>
      {row.previousRank != null ? (
        <Typography variant="caption" color={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textMuted'} style={styles.delta}>
          {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '—'}
        </Typography>
      ) : null}
      <Typography variant="mono" style={styles.score}>
        {formatNumber(row.score)}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  podiumTile: { flex: 1 },
  podiumCard: { borderWidth: 1, borderRadius: 20, padding: 12, alignItems: 'center', gap: 6 },
  medal: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  podiumName: { maxWidth: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  pressed: { opacity: 0.7 },
  rank: { width: 32 },
  identity: { flex: 1, gap: 2 },
  delta: { width: 36, textAlign: 'right' },
  score: { minWidth: 56, textAlign: 'right' },
});

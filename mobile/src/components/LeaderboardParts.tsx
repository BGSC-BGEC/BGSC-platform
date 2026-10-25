import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../responsive/useResponsive';
import { Typography } from '../typography/Typography';
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

/** Top-three podium laid out 2 · 1 · 3 with the winner raised. */
export function Podium({ rows, unit = 'pts' }: { rows: RankedRow[]; unit?: string }) {
  const { colors } = useTheme();
  const { isCompactPhone } = useResponsive();
  if (rows.length === 0) return null;
  return (
    <View style={[styles.podium, isCompactPhone && styles.podiumCompact]}>
      {[rows[1], rows[0], rows[2]].map((row, column) => {
        if (!row) return <View key={`empty-${column}`} style={styles.podiumTile} />;
        const place = column === 1 ? 1 : column === 0 ? 2 : 3;
        const avatarSize = place === 1 ? (isCompactPhone ? 52 : 60) : isCompactPhone ? 42 : 48;
        return (
          <View key={row.key} style={styles.podiumTile}>
            <Avatar
              name={row.name}
              uri={row.avatarUrl}
              size={avatarSize}
              ring
              style={{ borderColor: place === 1 ? colors.warning : colors.border }}
            />
            <Typography
              variant="caption"
              align="center"
              numberOfLines={1}
              style={styles.podiumName}
            >
              {row.name}
            </Typography>
            <View
              style={[
                styles.podiumCard,
                {
                  minHeight: place === 1 ? (isCompactPhone ? 124 : 144) : place === 2 ? (isCompactPhone ? 98 : 112) : isCompactPhone ? 84 : 96,
                  backgroundColor: place === 1 ? colors.warningMuted : colors.surface,
                  borderColor: place === 1 ? colors.warning : row.isMe ? colors.accent : colors.border,
                },
              ]}
            >
              <Typography
                variant={isCompactPhone ? 'h1' : 'displayTitle'}
                color={place === 1 ? 'warning' : 'text'}
                numberOfLines={1}
              >
                {place}
              </Typography>
              <Typography
                variant="caption"
                align="center"
                color="textMuted"
                numberOfLines={1}
              >
                {formatNumber(row.score)} {unit}
              </Typography>
            </View>
          </View>
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
      <Typography variant="mono" numberOfLines={1} style={styles.score}>
        {formatNumber(row.score)}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  podiumCompact: { gap: 8 },
  podiumTile: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  podiumCard: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 8, alignItems: 'center', justifyContent: 'center', gap: 4 },
  podiumName: { maxWidth: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  pressed: { opacity: 0.7 },
  rank: { minWidth: 24 },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  delta: { minWidth: 24, textAlign: 'right' },
  score: { minWidth: 40, maxWidth: 84, textAlign: 'right' },
});

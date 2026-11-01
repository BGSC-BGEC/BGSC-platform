import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../responsive/useResponsive';
import { Typography } from '../typography/Typography';
import { Avatar } from './Avatar';
import { formatNumber } from '../utils/format';
import { withAlpha } from '../theme/colors';

export interface RankedRow {
  key: string;
  rank: number | null;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  score: number;
  previousRank?: number | null;
  delta?: number;
  isMe?: boolean;
}

/**
 * Premium Minted BGSC Gold Coin
 * Features dual-tone gold rims, etched concentric coin ridges, and a star insignia.
 */
export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FBBF24" />
          <Stop offset="50%" stopColor="#F59E0B" />
          <Stop offset="100%" stopColor="#D97706" />
        </LinearGradient>
        <LinearGradient id="innerCoinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FEF3C7" />
          <Stop offset="100%" stopColor="#F59E0B" />
        </LinearGradient>
      </Defs>

      <Circle cx="12" cy="12" r="10" fill="url(#coinGrad)" stroke="#B45309" strokeWidth="0.8" />
      <Circle cx="12" cy="12" r="8" stroke="#FEF3C7" strokeWidth="1" strokeDasharray="1.5 1.5" strokeOpacity={0.8} />
      <Circle cx="12" cy="12" r="5.5" fill="url(#innerCoinGrad)" />
      <Path
        d="M12 8.5L13 10.8L15.4 11.1L13.6 12.7L14.1 15.1L12 13.9L9.9 15.1L10.4 12.7L8.6 11.1L11 10.8L12 8.5Z"
        fill="#92400E"
      />
    </Svg>
  );
}

/**
 * Royal Gold Crown for #1 Champion
 * Features 3 jeweled spires, diamond tips, and an etched headband.
 */
function CrownIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FDE68A" />
          <Stop offset="50%" stopColor="#F59E0B" />
          <Stop offset="100%" stopColor="#D97706" />
        </LinearGradient>
      </Defs>
      <Path
        d="M3 17.5L5.5 8L9.5 12.5L12 5.5L14.5 12.5L18.5 8L21 17.5H3Z"
        fill="url(#crownGrad)"
        stroke="#B45309"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <Circle cx="5.5" cy="7.5" r="1.6" fill="#FFFFFF" stroke="#D97706" strokeWidth="0.8" />
      <Circle cx="12" cy="5" r="2" fill="#FFFFFF" stroke="#D97706" strokeWidth="0.8" />
      <Circle cx="18.5" cy="7.5" r="1.6" fill="#FFFFFF" stroke="#D97706" strokeWidth="0.8" />
      <Circle cx="12" cy="14" r="1.2" fill="#E07A3F" />
      <Rect x="3.5" y="17" width="17" height="3" rx="1.5" fill="#B45309" />
      <Rect x="4" y="17.5" width="16" height="2" rx="1" fill="#FDE68A" />
    </Svg>
  );
}

/** Top-three podium laid out 2 · 1 · 3 with the winner raised and 3D pedestal styling */
export function Podium({
  rows,
  unit = 'pts',
  onPressRow,
}: {
  rows: RankedRow[];
  unit?: string;
  onPressRow?: (row: RankedRow) => void;
}) {
  const { colors, isDark } = useTheme();
  const { isCompactPhone } = useResponsive();
  if (rows.length === 0) return null;

  const championGold = isDark ? '#D97706' : '#E07A3F';
  const championTopSheen = isDark ? 'rgba(254, 243, 199, 0.45)' : 'rgba(255, 255, 255, 0.55)';
  const championGlow = isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(224, 122, 63, 0.25)';

  const silverPedestal = isDark ? '#3A424E' : '#E2E8F0';
  const silverTopSheen = isDark ? 'rgba(226, 232, 240, 0.35)' : 'rgba(255, 255, 255, 0.6)';

  const bronzePedestal = isDark ? '#353335' : '#EAE0D5';
  const bronzeTopSheen = isDark ? 'rgba(217, 119, 6, 0.3)' : 'rgba(255, 255, 255, 0.5)';

  return (
    <View style={styles.podiumContainer}>
      <View
        style={[
          styles.ambientHalo,
          {
            backgroundColor: withAlpha(colors.primary, isDark ? 0.14 : 0.08),
          },
        ]}
        pointerEvents="none"
      />

      <View style={[styles.podium, isCompactPhone && styles.podiumCompact]}>
        {[rows[1], rows[0], rows[2]].map((row, column) => {
          if (!row) return <View key={`empty-${column}`} style={styles.podiumTile} />;
          const place = column === 1 ? 1 : column === 0 ? 2 : 3;
          const isChampion = place === 1;
          const avatarSize = isChampion ? (isCompactPhone ? 58 : 66) : isCompactPhone ? 46 : 52;
          const pedestalHeight = isChampion
            ? isCompactPhone ? 142 : 162
            : place === 2
            ? isCompactPhone ? 106 : 120
            : isCompactPhone ? 90 : 102;

          const pedestalBg = isChampion
            ? championGold
            : place === 2
            ? silverPedestal
            : bronzePedestal;

          const topBorderColor = isChampion
            ? championTopSheen
            : place === 2
            ? silverTopSheen
            : bronzeTopSheen;

          const ringColor = isChampion
            ? '#F59E0B'
            : place === 2
            ? '#94A3B8'
            : '#B45309';

          const scorePillBg = isChampion
            ? isDark ? '#B45309' : '#D4632A'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)';

          const scoreTextColor = isChampion
            ? '#FFFFFF'
            : colors.text;

          return (
            <Pressable
              key={row.key}
              style={styles.podiumTile}
              onPress={() => onPressRow?.(row)}
              disabled={!onPressRow}
              accessibilityRole="button"
              accessibilityLabel={`Rank ${row.rank ?? place}, ${row.name}, ${row.score} ${unit}`}
            >
              {/* Avatar + Crown */}
              <View style={styles.avatarWrapper}>
                {isChampion && (
                  <View style={styles.crownContainer}>
                    <CrownIcon size={isCompactPhone ? 24 : 28} />
                  </View>
                )}
                <Avatar
                  name={row.name}
                  uri={row.avatarUrl}
                  size={avatarSize}
                  ring
                  style={{
                    borderColor: ringColor,
                    borderWidth: isChampion ? 3 : 2,
                    shadowColor: isChampion ? '#F59E0B' : 'transparent',
                    shadowOpacity: isChampion ? 0.45 : 0,
                    shadowRadius: 10,
                  }}
                />
              </View>

              {/* Handle / Name */}
              <Typography
                variant="caption"
                align="center"
                numberOfLines={1}
                style={isChampion ? [styles.podiumName, { fontWeight: '700', color: colors.text }] : styles.podiumName}
              >
                {row.subtitle || `@${row.name.toLowerCase().replace(/\s+/g, '')}`}
              </Typography>

              {/* Floating Score Badge with Coin */}
              <View
                style={[
                  styles.scorePill,
                  {
                    backgroundColor: scorePillBg,
                    borderColor: isChampion ? 'rgba(254, 243, 199, 0.4)' : colors.border,
                  },
                ]}
              >
                <CoinIcon size={12} />
                <Typography
                  variant="mono"
                  align="center"
                  style={[styles.scorePillText, { color: scoreTextColor }]}
                >
                  {formatNumber(row.score)}
                </Typography>
              </View>

              {/* 3D Pedestal Block */}
              <View
                style={[
                  styles.pedestalCard,
                  {
                    height: pedestalHeight,
                    backgroundColor: pedestalBg,
                    shadowColor: isChampion ? championGlow : isDark ? '#1E2226' : '#D1CCC7',
                    shadowOpacity: isChampion ? 0.4 : 0.25,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    borderTopColor: topBorderColor,
                    borderTopWidth: 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.pedestalSheen,
                    {
                      backgroundColor: isChampion
                        ? 'rgba(255, 255, 255, 0.12)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(255, 255, 255, 0.4)',
                    },
                  ]}
                />

                <Typography
                  style={[
                    styles.embossedNumber,
                    {
                      color: isChampion
                        ? 'rgba(255, 255, 255, 0.4)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.15)',
                      fontSize: isChampion ? (isCompactPhone ? 58 : 70) : isCompactPhone ? 42 : 50,
                    },
                  ]}
                >
                  {place}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One standings row: floating capsule card with rank, delta badge, avatar, name, and gold coin score */
export function StandingRow({
  row,
  onPress,
  unit = 'pts',
}: {
  row: RankedRow;
  onPress?: () => void;
  unit?: string;
}) {
  const { colors, isDark } = useTheme();

  // Compute or simulate rank delta
  const delta =
    row.delta ??
    (row.rank != null && row.previousRank != null
      ? row.previousRank - row.rank
      : row.rank && row.rank % 2 === 0
      ? 12
      : -4);

  const cardBg = row.isMe
    ? isDark
      ? withAlpha(colors.primary, 0.14)
      : withAlpha(colors.primary, 0.08)
    : colors.surface;

  const cardBorder = row.isMe
    ? colors.primary
    : colors.border;

  const rankColor =
    row.rank === 1
      ? '#F59E0B'
      : row.rank === 2
      ? '#94A3B8'
      : row.rank === 3
      ? '#B45309'
      : row.isMe
      ? colors.primary
      : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.rowCard,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          borderWidth: row.isMe ? 1.5 : 1,
          shadowColor: isDark ? colors.shadowDark : colors.shadowDark,
          shadowOpacity: row.isMe ? 0.25 : 0.1,
          shadowRadius: row.isMe ? 8 : 4,
          shadowOffset: { width: 0, height: 2 },
        },
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Rank ${row.rank ?? 'unranked'}, ${row.name}, ${row.score} ${unit}`}
    >
      {/* Rank Indicator */}
      <View style={styles.rankBadge}>
        <Typography
          variant="caption"
          style={styles.trophyIcon}
        >
          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank && row.rank <= 5 ? '⭐' : '•'}
        </Typography>
        <Typography
          variant="mono"
          style={[styles.rankNumber, { color: rankColor }]}
        >
          {row.rank ?? '—'}
        </Typography>
      </View>

      {/* Avatar */}
      <Avatar
        name={row.name}
        uri={row.avatarUrl}
        size={40}
        ring
        style={{
          borderColor: row.isMe ? colors.primary : colors.border,
          borderWidth: row.isMe ? 2 : 1,
        }}
      />

      {/* Identity & Rank Delta */}
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Typography
            variant="body"
            numberOfLines={1}
            style={[
              styles.nameText,
              { color: row.isMe ? colors.primary : colors.text },
            ]}
          >
            {row.subtitle || `@${row.name.toLowerCase().replace(/\s+/g, '')}`}
          </Typography>

          {delta !== 0 && (
            <View
              style={[
                styles.deltaBadge,
                {
                  backgroundColor:
                    delta > 0
                      ? withAlpha(colors.success, 0.16)
                      : withAlpha(colors.danger, 0.14),
                },
              ]}
            >
              <Typography
                style={[
                  styles.deltaText,
                  { color: delta > 0 ? colors.success : colors.dangerText },
                ]}
              >
                {delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}
              </Typography>
            </View>
          )}
        </View>

        {/* Subtitle / Affiliation */}
        <Typography variant="caption" color="textMuted" numberOfLines={1} style={styles.subText}>
          {row.isMe ? 'You · BITS Goa' : `${row.name} · BITS Goa`}
        </Typography>
      </View>

      <View style={styles.scoreContainer}>
        <CoinIcon size={16} />
        <Typography
          variant="mono"
          numberOfLines={1}
          style={[
            styles.scoreValue,
            { color: row.isMe ? colors.primary : colors.text },
          ]}
        >
          {formatNumber(row.score)}
        </Typography>
      </View>
    </Pressable>
  );
}

/**
 * Floating Sticky "You" Pill at the bottom
 * Styled in the app's executive dark slate / warm amber aesthetic.
 */
export function MyPositionPill({
  me,
  onPress,
}: {
  me: RankedRow | null;
  onPress?: () => void;
}) {
  const { colors, isDark } = useTheme();
  if (!me) return null;

  const pillBg = isDark ? '#1E2226' : '#FFFFFF';
  const pillBorder = colors.primary;

  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.floatingPill,
          {
            backgroundColor: pillBg,
            borderColor: pillBorder,
            shadowColor: colors.primary,
            shadowOpacity: isDark ? 0.4 : 0.25,
          },
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        ]}
      >
        <Avatar
          name={me.name}
          uri={me.avatarUrl}
          size={30}
          ring
          style={{ borderColor: colors.primary, borderWidth: 1.5 }}
        />
        <Typography style={[styles.floatingYouText, { color: colors.text }]}>
          You
        </Typography>

        <View style={[styles.floatingBadge, { backgroundColor: colors.primary }]}>
          <Typography style={styles.floatingBadgeText}>
            {`▲ ${me.rank ? `${me.rank}th` : 'Top 10%'}`}
          </Typography>
        </View>

        <View style={styles.floatingPoints}>
          <CoinIcon size={14} />
          <Typography variant="mono" style={[styles.floatingPointsText, { color: colors.text }]}>
            {formatNumber(me.score)}
          </Typography>
        </View>

        <Typography style={[styles.floatingChevron, { color: colors.primary }]}>
          ⌄
        </Typography>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  podiumContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ambientHalo: {
    position: 'absolute',
    top: 40,
    width: 240,
    height: 140,
    borderRadius: 120,
    alignSelf: 'center',
  },
  podium: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    width: '100%',
  },
  podiumCompact: { gap: 8 },
  podiumTile: { flex: 1, minWidth: 0, alignItems: 'center' },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  crownContainer: {
    position: 'absolute',
    top: -18,
    zIndex: 10,
  },
  podiumName: {
    maxWidth: '100%',
    marginBottom: 6,
    fontSize: 13,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    minWidth: 54,
    justifyContent: 'center',
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pedestalCard: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  pedestalSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: '50%',
    bottom: 0,
  },
  embossedNumber: {
    fontFamily: 'Inter_900Black',
    fontWeight: '900',
    letterSpacing: -2,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  pressed: { opacity: 0.8 },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 34,
  },
  trophyIcon: {
    fontSize: 12,
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontWeight: '700',
    fontSize: 14,
  },
  deltaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subText: {
    fontSize: 11,
    opacity: 0.7,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  floatingYouText: {
    fontWeight: '800',
    fontSize: 14,
  },
  floatingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  floatingBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  floatingPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  floatingPointsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  floatingChevron: {
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 2,
  },
});

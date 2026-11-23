import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { BDomeArt } from './BDomeArt';
import { cardTierStyle, type CardTierStyle } from './cardTiers';
import { Doodle, type DoodleName } from '../doodles/Doodles';
import { FONT_FAMILIES } from '../../theme/typography';

/** Fixed design size: the card is captured as an image, so it never reflows. */
export const PLAYER_CARD_WIDTH = 300;
export const PLAYER_CARD_HEIGHT = 480;

export interface PlayerCardViewProps {
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  tier: string;
  rating: number;
  events: number;
  podiums: number;
  challenges: number;
  interests: string[];
}

const BAND_ICONS: DoodleName[] = ['controller', 'football', 'headphones', 'trophy'];

/**
 * BGSC player card: tier-styled frame, the illustrated BDome as the centrepiece with the avatar
 * on its front platform, name and handle, a stat block and top interests. Fixed size so
 * `react-native-view-shot` exports the same card everywhere.
 */
export function PlayerCardView(props: PlayerCardViewProps) {
  const t = cardTierStyle(props.tier);
  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    <View style={[styles.card, { backgroundColor: t.frame }]} collapsable={false}>
      <CardFrame t={t} />

      {/* Plaque */}
      <View style={[styles.plaque, { backgroundColor: t.bg, borderColor: t.accent }]}>
        <Shield color={t.accent} />
        <Text style={[styles.plaqueText, { color: t.ink }]}>BGSC</Text>
      </View>

      {/* BDome: the centrepiece, fully visible above the avatar */}
      <View style={styles.art} pointerEvents="none">
        <BDomeArt width={260} />
      </View>
      <Sparkles color={t.accent} />

      {/* Avatar */}
      <View style={[styles.avatarRing, { borderColor: t.ring, backgroundColor: t.bg }]}>
        <View style={[styles.avatar, { backgroundColor: t.avatarBg }]}>
          {props.avatarUrl ? (
            <Image source={{ uri: props.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.initials, { color: t.ink }]}>{initials || '?'}</Text>
          )}
        </View>
      </View>

      {/* Identity */}
      <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>
        {props.fullName}
      </Text>
      <Text style={[styles.handle, { color: t.inkMuted }]} numberOfLines={1}>
        @{props.username}
      </Text>
      <View style={[styles.tierPill, { borderColor: t.accent }]}>
        <Text style={[styles.tierText, { color: t.accent }]}>★ {t.label.toUpperCase()} TIER</Text>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statCol}>
          <Stat label="EVENTS" value={props.events} t={t} />
          <Stat label="PODIUMS" value={props.podiums} t={t} />
        </View>
        <View style={[styles.statDivider, { borderColor: t.inkMuted }]} />
        <View style={styles.statCol}>
          <Stat label="CHALLENGES" value={props.challenges} t={t} />
          <Stat label="RATING" value={props.rating} t={t} />
        </View>
      </View>

      {/* Interests */}
      <View style={styles.chips}>
        {props.interests.slice(0, 3).map((i) => (
          <View key={i} style={[styles.chip, { backgroundColor: t.chipBg, borderColor: t.accent }]}>
            <Text style={[styles.chipText, { color: t.chipText }]} numberOfLines={1}>
              {i.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>

      {/* Icon band */}
      <View style={[styles.band, { backgroundColor: t.band, borderColor: t.accent }]}>
        {BAND_ICONS.map((name) => (
          <Doodle key={name} name={name} size={26} color={t.bandIcon} strokeWidth={2} />
        ))}
      </View>
    </View>
  );
}

function Stat({ label, value, t }: { label: string; value: number; t: CardTierStyle }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: t.inkMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: t.ink }]}>{value.toLocaleString('en-IN')}</Text>
    </View>
  );
}

/** Frame: body panel, inner border line, corner stars and side scrolls. */
function CardFrame({ t }: { t: CardTierStyle }) {
  const W = PLAYER_CARD_WIDTH;
  const H = PLAYER_CARD_HEIGHT;
  const corner = (x: number, y: number) =>
    `M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`;
  const scroll = (x: number, dir: 1 | -1) =>
    `M${x} ${H / 2 - 26} C${x + 12 * dir} ${H / 2 - 18} ${x + 12 * dir} ${H / 2 + 18} ${x} ${H / 2 + 26} M${x + 4 * dir} ${H / 2 - 8} C${x + 9 * dir} ${H / 2 - 4} ${x + 9 * dir} ${H / 2 + 4} ${x + 4 * dir} ${H / 2 + 8}`;

  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Rect x={1} y={1} width={W - 2} height={H - 2} rx={18} fill={t.frame} stroke={t.frameDeep} strokeWidth={2} />
      <Rect x={9} y={9} width={W - 18} height={H - 18} rx={12} fill={t.bg} />
      <Rect x={15} y={15} width={W - 30} height={H - 30} rx={9} fill="none" stroke={t.accent} strokeWidth={1.2} opacity={0.7} />
      {[
        [17, 17],
        [W - 17, 17],
        [17, H - 17],
        [W - 17, H - 17],
      ].map(([x, y]) => (
        <Path key={`${x}-${y}`} d={corner(x!, y!)} fill={t.frame} stroke={t.accent} strokeWidth={1} />
      ))}
      <Path d={scroll(16, 1)} fill="none" stroke={t.accent} strokeWidth={1.4} strokeLinecap="round" />
      <Path d={scroll(W - 16, -1)} fill="none" stroke={t.accent} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={40} y1={H - 66} x2={W - 40} y2={H - 66} stroke={t.accent} strokeWidth={0.8} opacity={0.4} />
    </Svg>
  );
}

function Shield({ color }: { color: string }) {
  return (
    <Svg width={16} height={18} viewBox="0 0 16 18">
      <Path d="M8 1 L15 4 V9 C15 13 12 16 8 17 C4 16 1 13 1 9 V4 Z" fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M8 1 V17 M1 8 H15" stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

/** A few four-point sparkles around the dome, like the sample cards. */
function Sparkles({ color }: { color: string }) {
  const star = (x: number, y: number, r: number) =>
    `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
  return (
    <Svg width={PLAYER_CARD_WIDTH} height={200} style={styles.sparkles} pointerEvents="none">
      {[
        [48, 70, 6],
        [258, 64, 7],
        [214, 56, 3.5],
      ].map(([x, y, r]) => (
        <Path key={`${x}-${y}`} d={star(x!, y!, r!)} fill={color} opacity={0.75} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PLAYER_CARD_WIDTH,
    height: PLAYER_CARD_HEIGHT,
    borderRadius: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  plaque: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.4,
  },
  plaqueText: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 17,
    letterSpacing: 1,
  },
  art: {
    position: 'absolute',
    top: 52,
    left: 20,
  },
  sparkles: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarRing: {
    marginTop: 125,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    padding: 2,
  },
  avatar: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 24,
  },
  name: {
    marginTop: 6,
    maxWidth: 240,
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 24,
    lineHeight: 28,
  },
  handle: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 13,
    marginTop: 1,
  },
  tierPill: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  tierText: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  stats: {
    marginTop: 12,
    width: 236,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statCol: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 6,
  },
  statDivider: {
    borderLeftWidth: 1.2,
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  statValue: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 17,
  },
  chips: {
    marginTop: 10,
    height: 22,
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    maxWidth: 90,
  },
  chipText: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  band: {
    position: 'absolute',
    bottom: 22,
    left: 22,
    right: 22,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
});

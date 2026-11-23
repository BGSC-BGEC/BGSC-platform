import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { BDOME_ASPECT, BDomeArt } from './BDomeArt';
import { cardTierStyle, type CardTierPalette } from './cardTiers';
import { Doodle, type DoodleName } from '../doodles/Doodles';
import { FONT_FAMILIES } from '../../theme/typography';
import { useTheme } from '../../theme/ThemeProvider';
import type { ThemeMode } from '../../theme/colors';

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
  /** Defaults to the app theme. */
  mode?: ThemeMode;
}

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;
/** Foil border width */
const B = 3;
/** Where the hero panel meets the body; the avatar sits centred on this line. */
const SEAM = 214;
const AVATAR = 92;
const DOME_W = 210;

const FOOTER_ICONS: DoodleName[] = ['controller', 'football', 'headphones', 'trophy'];

/**
 * BGSC player card, trading-card style: a tier-tinted hero with the rating up front and the BDome
 * behind the avatar, then name, three stats and top interests on a body that follows the theme.
 * The tier shows in the metal: foil border, avatar ring and hero seam. Fixed size so
 * `react-native-view-shot` exports the same card everywhere.
 */
export function PlayerCardView(props: PlayerCardViewProps) {
  const theme = useTheme();
  const mode = props.mode ?? theme.mode;
  const t = cardTierStyle(props.tier, mode);
  // SVG ids are document-global on web, and the profile and share sheet can show the same card.
  const id = React.useId().replace(/:/g, '');

  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    <View style={styles.card} collapsable={false}>
      <CardBackground t={t} id={id} sheen={mode === 'dark' ? 0.06 : 0.14} />

      {/* Rating and tier, top left */}
      <View style={styles.ratingBlock}>
        <Text style={[styles.rating, { color: t.heroInk }]}>{props.rating.toLocaleString('en-IN')}</Text>
        <Text style={[styles.tierText, { color: t.heroAccent }]}>{t.label.toUpperCase()} TIER</Text>
      </View>

      {/* Wordmark, top right */}
      <View style={styles.wordmark}>
        <Shield color={t.heroInk} />
        <Text style={[styles.wordmarkText, { color: t.heroInk }]}>BGSC</Text>
      </View>

      {/* BDome, standing on the seam */}
      <View style={styles.dome} pointerEvents="none">
        <BDomeArt width={DOME_W} />
      </View>

      {/* Avatar in a foil ring, centred on the seam */}
      <View style={styles.avatarWrap}>
        <Svg width={AVATAR} height={AVATAR} style={StyleSheet.absoluteFill}>
          <Defs>
            <FoilGradient id={`ring-${id}`} t={t} />
          </Defs>
          <Circle cx={AVATAR / 2} cy={AVATAR / 2} r={AVATAR / 2} fill={`url(#ring-${id})`} />
        </Svg>
        <View style={[styles.avatarGap, { backgroundColor: t.surface }]}>
          <View style={[styles.avatar, { backgroundColor: t.avatarBg }]}>
            {props.avatarUrl ? (
              <Image source={{ uri: props.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.initials, { color: t.ink }]}>{initials || '?'}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Identity */}
      <Text
        style={[styles.name, { color: t.ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {props.fullName}
      </Text>
      <Text style={[styles.handle, { color: t.inkMuted }]} numberOfLines={1}>
        @{props.username}
      </Text>

      {/* Stats */}
      <View style={[styles.stats, { borderColor: t.hairline }]}>
        <Stat label="EVENTS" value={props.events} t={t} />
        <View style={[styles.statDivider, { backgroundColor: t.hairline }]} />
        <Stat label="PODIUMS" value={props.podiums} t={t} />
        <View style={[styles.statDivider, { backgroundColor: t.hairline }]} />
        <Stat label="CHALLENGES" value={props.challenges} t={t} />
      </View>

      {/* Interests */}
      <View style={styles.chips}>
        {props.interests.slice(0, 3).map((i) => (
          <View key={i} style={[styles.chip, { backgroundColor: t.chipBg }]}>
            <Text style={[styles.chipText, { color: t.chipText }]} numberOfLines={1}>
              {i}
            </Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerIcons}>
          {FOOTER_ICONS.map((name) => (
            <Doodle key={name} name={name} size={15} color={t.inkMuted} strokeWidth={2} />
          ))}
        </View>
        <Text style={[styles.footerText, { color: t.inkMuted }]}>PLAYER CARD</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, t }: { label: string; value: number; t: CardTierPalette }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: t.ink }]}>{value.toLocaleString('en-IN')}</Text>
      <Text style={[styles.statLabel, { color: t.inkMuted }]}>{label}</Text>
    </View>
  );
}

/** Diagonal metal: dark edge, highlight across the middle, dark edge. */
function FoilGradient({ id, t }: { id: string; t: CardTierPalette }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor={t.foil[0]} />
      <Stop offset="0.45" stopColor={t.foil[1]} />
      <Stop offset="0.55" stopColor={t.foil[1]} />
      <Stop offset="1" stopColor={t.foil[2]} />
    </LinearGradient>
  );
}

/** Foil border, body, hero panel with a light sheen, and the foil seam under the hero. */
function CardBackground({ t, id, sheen }: { t: CardTierPalette; id: string; sheen: number }) {
  const r = 17; // inner corner radius
  const hero = `M${B} ${SEAM} V${B + r} Q${B} ${B} ${B + r} ${B} H${W - B - r} Q${W - B} ${B} ${W - B} ${B + r} V${SEAM} Z`;
  const sheenBand = `M168 ${B} L222 ${B} L118 ${SEAM} L64 ${SEAM} Z`;
  const star = (x: number, y: number, s: number) =>
    `M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`;

  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Defs>
        <FoilGradient id={`foil-${id}`} t={t} />
        <LinearGradient id={`hero-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.heroTop} />
          <Stop offset="1" stopColor={t.heroBottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} rx={r + B} fill={`url(#foil-${id})`} />
      <Rect x={B} y={B} width={W - B * 2} height={H - B * 2} rx={r} fill={t.surface} />
      <Path d={hero} fill={`url(#hero-${id})`} />
      <Path d={sheenBand} fill="#FFFFFF" opacity={sheen} />
      {[
        [252, 96, 5],
        [236, 80, 2.5],
        [52, 120, 3.5],
      ].map(([x, y, s]) => (
        <Path key={`${x}-${y}`} d={star(x!, y!, s!)} fill={t.heroAccent} opacity={0.6} />
      ))}
      <Rect x={B} y={SEAM - 1} width={W - B * 2} height={2} fill={`url(#foil-${id})`} />
    </Svg>
  );
}

function Shield({ color }: { color: string }) {
  return (
    <Svg width={13} height={15} viewBox="0 0 16 18">
      <Path d="M8 1 L15 4 V9 C15 13 12 16 8 17 C4 16 1 13 1 9 V4 Z" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M8 1 V17 M1 8 H15" stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
    borderRadius: 20,
    overflow: 'hidden',
  },
  ratingBlock: {
    position: 'absolute',
    top: 20,
    left: 22,
  },
  rating: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 40,
    lineHeight: 46,
  },
  tierText: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    marginTop: -2,
  },
  wordmark: {
    position: 'absolute',
    top: 24,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wordmarkText: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 15,
    letterSpacing: 1,
  },
  dome: {
    position: 'absolute',
    top: SEAM - DOME_W / BDOME_ASPECT,
    left: (W - DOME_W) / 2,
  },
  avatarWrap: {
    position: 'absolute',
    top: SEAM - AVATAR / 2,
    left: (W - AVATAR) / 2,
    width: AVATAR,
    height: AVATAR,
    padding: 4,
  },
  avatarGap: {
    flex: 1,
    borderRadius: 999,
    padding: 3,
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
    fontSize: 28,
  },
  name: {
    position: 'absolute',
    top: SEAM + AVATAR / 2 + 10,
    left: 22,
    right: 22,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 26,
    lineHeight: 31,
  },
  handle: {
    position: 'absolute',
    top: SEAM + AVATAR / 2 + 42,
    left: 22,
    right: 22,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 13,
  },
  stats: {
    position: 'absolute',
    top: 334,
    left: 22,
    right: 22,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  statValue: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 22,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  chips: {
    position: 'absolute',
    top: 408,
    left: 22,
    right: 22,
    height: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    justifyContent: 'center',
    maxWidth: 110,
    // Three long interests must shrink (and ellipsize) inside the 256px row, not spill past the foil.
    flexShrink: 1,
    minWidth: 0,
  },
  chipText: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  footerText: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
  },
});

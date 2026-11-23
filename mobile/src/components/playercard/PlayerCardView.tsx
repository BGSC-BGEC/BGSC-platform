import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { BDOME_LINE_ASPECT, BDomeLineArt } from './BDomeLineArt';
import { CardLogo } from './cardLogos';
import { cardTierStyle, type CardTierPalette } from './cardTiers';
import { Doodle } from '../doodles/Doodles';
import { FONT_FAMILIES } from '../../theme/typography';
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
  /** Points balance; styles that show points read it, others ignore it. */
  points?: number;
  interests: string[];
  /** Logo id from `CARD_LOGOS`. Classic keeps its shield wordmark when none is chosen. */
  logo?: string;
  /** Kept for callers; the beach looks the same in both themes. */
  mode?: ThemeMode;
}

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;
/** Foil border width */
const B = 3;
/** Inner corner radius */
const R = 17;
/** Where the ocean meets the sand: a wavy shoreline, the avatar centred on it. */
const SEAM = 214;
const AVATAR = 92;
/** The default card leads with the BDome: nearly the full width of the water. */
const DOME_W = 280;
const DOME_H = DOME_W / BDOME_LINE_ASPECT;

/** A flat 2D beach: ocean blues, sand, foam. The tier lives only in the metal. */
const C = {
  oceanDeep: '#0E5E7E',
  oceanMid: '#1592A8',
  oceanShallow: '#3CC6C4',
  foam: '#FFFFFF',
  sand: '#EED9B0',
  sandWet: '#D9B98A',
  sandDark: '#C9A877',
  sandLight: '#FFF3DA',
  /** Text on sand (≥ 4.5:1 on `sand`) */
  ink: '#3B2A16',
  inkMuted: '#6E5130',
  tile: 'rgba(255, 255, 255, 0.5)',
  tileEdge: '#D8BE92',
  chipBg: 'rgba(14, 94, 126, 0.12)',
  chipText: '#0E4F69',
  /** On the water */
  onWater: '#FFFFFF',
  onWaterAccent: '#C8FAF5',
};

/** Seeded so every card and every render gets the same texture. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The shoreline: gentle waves across the card at SEAM. */
const SHORE = (() => {
  const len = 37.5; // 8 half-waves across the card
  let d = `M${B} ${SEAM}`;
  for (let x = B, i = 0; x < W - B; x += len, i++) {
    const nx = Math.min(x + len, W - B);
    d += ` Q${(x + nx) / 2} ${SEAM + (i % 2 ? 8 : -8)} ${nx} ${SEAM}`;
  }
  return d;
})();

/** Ocean texture: staggered rows of small wave strokes. */
const WAVES = (() => {
  const parts: string[] = [];
  for (let row = 0, y = 22; y < SEAM - 18; row++, y += 15) {
    for (let x = (row % 2) * 15 - 10; x < W; x += 30) parts.push(`M${x} ${y} q5 -4 10 0 t10 0`);
  }
  return parts.join(' ');
})();

/** Sand grain: light and dark speckles below the shore. */
const GRAIN = (() => {
  const rand = seeded(0x5a17);
  const dark: string[] = [];
  const light: string[] = [];
  for (let i = 0; i < 220; i++) {
    const x = 6 + rand() * (W - 12);
    const y = SEAM + 14 + rand() * (H - SEAM - 20);
    const r = 0.6 + rand() * 0.9;
    // A dot as a tiny closed path, so all grain is two paths.
    (rand() < 0.55 ? dark : light).push(`M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`);
  }
  return { dark: dark.join(' '), light: light.join(' ') };
})();

/** Sun glints on the water: [x, y, size] */
const GLINTS: [number, number, number][] = [
  [48, 120, 4],
  [252, 140, 5],
  [214, 74, 3],
  [86, 176, 3],
];

/** Palms stand on the sand just below the waterline. */
const PALM_BASE = SEAM + 40;
/** Inner metal frame, inset from the border */
const FRAME_INSET = 5;
/** Rating medallion, top left */
const MEDAL = 64;
const MEDAL_TOP = 16;
const MEDAL_LEFT = 16;

const PALM_COLORS = {
  trunk: '#9C6B3C',
  trunkRing: '#7A5029',
  leaf: '#2E8B57',
  leafLight: '#45B36B',
  coconut: '#6B4423',
};

/** A palm frond from the crown (0,0) to `tip`, bulging to one side. */
function frond([tx, ty]: [number, number], bulge: number) {
  const [mx, my] = [tx / 2, ty / 2];
  const len = Math.hypot(tx, ty);
  const [px, py] = [(-ty / len) * bulge, (tx / len) * bulge];
  return `M0 0 Q${mx + px} ${my + py} ${tx} ${ty} Q${mx - px * 0.25} ${my - py * 0.25} 0 0 Z`;
}

/**
 * A flat 2D palm standing at (0,0), leaning right: tapered ringed trunk, fronds in two greens,
 * coconuts at the crown. Mirror with scale(-1 1) for the other side.
 */
const PALM = (() => {
  const crown: [number, number] = [20, -78];
  const trunk = `M-4 0 C-2 -30 6 -56 ${crown[0] - 2} ${crown[1]} L${crown[0] + 2} ${crown[1] + 1} C10 -54 4 -28 4 0 Z`;
  const rings = Array.from({ length: 6 }, (_, i) => {
    const t = (i + 1) / 7;
    const y = crown[1] * t;
    const x = crown[0] * t * t;
    return `M${x - 4 + t * 2} ${y} L${x + 4 - t * 2} ${y + 2}`;
  }).join(' ');
  const back: [number, number, number][] = [
    [-34, 6, 7],
    [40, 10, -8],
    [-6, -30, 6],
  ];
  const front: [number, number, number][] = [
    [-40, 22, -8],
    [46, 26, 8],
    [-24, -24, -6],
    [30, -22, 7],
  ];
  return { crown, trunk, rings, back, front };
})();

/**
 * BGSC player card, the default style: a flat 2D Goa beach. Ocean on top (deep blue to turquoise,
 * rows of small waves, sun glints, the BDome large in white line art), a foamy wavy shoreline with
 * the avatar on it, two coloured palms leaning in from the edges, and speckled sand below carrying
 * the name and a scoreboard. Calm palette: ocean, sand, foam, palm green.
 *
 * The tier shows in the metal: foil border and avatar ring. Same in both themes (it's a picture).
 * Fixed size so `react-native-view-shot` exports the same card everywhere.
 */
export function PlayerCardView(props: PlayerCardViewProps) {
  const t = cardTierStyle(props.tier, 'light');
  // SVG ids are document-global on web, and the profile and sheet can show the same card.
  const id = React.useId().replace(/:/g, '');

  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    <View style={styles.card} collapsable={false}>
      <Beach t={t} id={id} />

      {/* BDome over the water, behind the avatar */}
      <View style={styles.dome} pointerEvents="none">
        <BDomeLineArt width={DOME_W} color={C.onWater} strokeWidth={2.6} opacity={0.72} />
      </View>

      {/* Palms on the sand at both edges, leaning in over the water, in front of the dome */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <ClipPath id={`palms-${id}`}>
            <Rect x={B} y={B} width={W - B * 2} height={H - B * 2} rx={R} />
          </ClipPath>
          <FoilGradient id={`frame-${id}`} t={t} />
          {/* Holographic sheen: a soft diagonal band of light */}
          <LinearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.16} />
            <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <G clipPath={`url(#palms-${id})`}>
          <Palm transform={`translate(18 ${PALM_BASE})`} />
          <Palm transform={`translate(${W - 18} ${PALM_BASE}) scale(-1 1)`} />
          <Rect x={0} y={0} width={W} height={H} fill={`url(#sheen-${id})`} />
        </G>

        {/* Collector's double frame: a fine metal line inside the border */}
        <Rect
          x={B + FRAME_INSET}
          y={B + FRAME_INSET}
          width={W - (B + FRAME_INSET) * 2}
          height={H - (B + FRAME_INSET) * 2}
          rx={R - FRAME_INSET}
          fill="none"
          stroke={`url(#frame-${id})`}
          strokeWidth={1.2}
          opacity={0.85}
        />
        {/* Metal hairline above the footer */}
        <Rect x={22} y={H - 38} width={W - 44} height={1} fill={`url(#frame-${id})`} opacity={0.7} />
      </Svg>

      {/* Rating medallion: tier-metal ring, the rating inside, the tier beneath */}
      <View style={styles.medallion}>
        <Svg width={MEDAL} height={MEDAL} style={StyleSheet.absoluteFill}>
          <Defs>
            <FoilGradient id={`medal-${id}`} t={t} />
          </Defs>
          <Circle cx={MEDAL / 2} cy={MEDAL / 2} r={MEDAL / 2 - 2} fill="rgba(8, 50, 70, 0.45)" stroke={`url(#medal-${id})`} strokeWidth={3} />
          <Circle cx={MEDAL / 2} cy={MEDAL / 2} r={MEDAL / 2 - 7} fill="none" stroke="#FFFFFF" strokeWidth={0.8} opacity={0.45} />
        </Svg>
        <Text style={[styles.rating, styles.onWater]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {props.rating.toLocaleString('en-IN')}
        </Text>
      </View>
      <Text style={[styles.tierText, styles.onWater, { color: C.onWaterAccent }]}>{t.label.toUpperCase()}</Text>

      {/* Chosen logo, or the wordmark, top right */}
      {props.logo ? (
        <View style={styles.logo}>
          <CardLogo id={props.logo} height={38} />
        </View>
      ) : (
        <View style={styles.wordmark}>
          <Shield color={C.onWater} />
          <Text style={[styles.wordmarkText, styles.onWater]}>BGSC</Text>
        </View>
      )}

      {/* Avatar in a foil ring, on the shoreline */}
      <View style={styles.avatarWrap}>
        <Svg width={AVATAR} height={AVATAR} style={StyleSheet.absoluteFill}>
          <Defs>
            <FoilGradient id={`ring-${id}`} t={t} />
          </Defs>
          <Circle cx={AVATAR / 2} cy={AVATAR / 2} r={AVATAR / 2} fill={`url(#ring-${id})`} />
        </Svg>
        <View style={[styles.avatarGap, { backgroundColor: C.foam }]}>
          <View style={[styles.avatar, { backgroundColor: C.sandWet }]}>
            {props.avatarUrl ? (
              <Image source={{ uri: props.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.initials, { color: C.ink }]}>{initials || '?'}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Identity, in varsity letters */}
      <Text style={[styles.name, { color: C.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {props.fullName.toUpperCase()}
      </Text>
      <Text style={[styles.handle, { color: C.inkMuted }]} numberOfLines={1}>
        @{props.username}
      </Text>

      {/* Scoreboard */}
      <View style={styles.stats}>
        <Stat label="EVENTS" value={props.events} metal={t.foil[0]} />
        <Stat label="PODIUMS" value={props.podiums} metal={t.foil[0]} />
        <Stat label="CHALLENGES" value={props.challenges} metal={t.foil[0]} />
      </View>

      {/* Interests */}
      <View style={styles.chips}>
        {props.interests.slice(0, 3).map((i) => (
          <View key={i} style={[styles.chip, { backgroundColor: C.chipBg }]}>
            <Text style={[styles.chipText, { color: C.chipText }]} numberOfLines={1}>
              {i}
            </Text>
          </View>
        ))}
      </View>

      {/* Footer: campus on the left, game and sport on the right */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: C.inkMuted }]}>BITS PILANI · GOA</Text>
        <View style={styles.footerIcons}>
          <Doodle name="controller" size={15} color={C.inkMuted} strokeWidth={2.2} />
          <Doodle name="football" size={15} color={C.inkMuted} strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}

function Palm({ transform }: { transform: string }) {
  const [cx, cy] = PALM.crown;
  const leaves = (list: [number, number, number][], fill: string) =>
    list.map(([x, y, bulge]) => (
      <Path key={`${x}${y}`} d={frond([x, y], bulge)} transform={`translate(${cx} ${cy})`} fill={fill} />
    ));
  return (
    <G transform={transform}>
      {leaves(PALM.back, PALM_COLORS.leaf)}
      <Path d={PALM.trunk} fill={PALM_COLORS.trunk} />
      <Path d={PALM.rings} stroke={PALM_COLORS.trunkRing} strokeWidth={1.4} strokeLinecap="round" />
      {leaves(PALM.front, PALM_COLORS.leafLight)}
      <G fill={PALM_COLORS.coconut}>
        <Circle cx={cx - 3} cy={cy + 4} r={3.4} />
        <Circle cx={cx + 3} cy={cy + 5} r={3.4} />
        <Circle cx={cx} cy={cy + 9} r={3.2} />
      </G>
    </G>
  );
}

/** A scoreboard tile on the sand: label on top, the score in varsity numerals. */
function Stat({ label, value, metal }: { label: string; value: number; metal: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: C.tile, borderColor: C.tileEdge }]}>
      <View style={[styles.statStrip, { backgroundColor: metal }]} />
      <Text style={[styles.statLabel, { color: C.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: C.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value.toLocaleString('en-IN')}
      </Text>
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

/** Foil border, sand with its grain, ocean with waves and glints, then the foam shoreline. */
function Beach({ t, id }: { t: CardTierPalette; id: string }) {
  // Along the shoreline left to right, then back across the rounded top.
  const oceanPath = `M${B} ${SEAM} ${SHORE.slice(SHORE.indexOf('Q'))} L${W - B} ${B + R} Q${W - B} ${B} ${W - B - R} ${B} H${B + R} Q${B} ${B} ${B} ${B + R} Z`;

  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Defs>
        <FoilGradient id={`foil-${id}`} t={t} />
        <LinearGradient id={`ocean-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.oceanDeep} />
          <Stop offset="0.6" stopColor={C.oceanMid} />
          <Stop offset="1" stopColor={C.oceanShallow} />
        </LinearGradient>
        <ClipPath id={`ocean-clip-${id}`}>
          <Path d={oceanPath} />
        </ClipPath>
        <ClipPath id={`inner-${id}`}>
          <Rect x={B} y={B} width={W - B * 2} height={H - B * 2} rx={R} />
        </ClipPath>
      </Defs>

      {/* Foil border, then sand */}
      <Rect x={0} y={0} width={W} height={H} rx={R + B} fill={`url(#foil-${id})`} />
      <Rect x={B} y={B} width={W - B * 2} height={H - B * 2} rx={R} fill={C.sand} />

      <G clipPath={`url(#inner-${id})`}>
        {/* Sand grain */}
        <Path d={GRAIN.dark} fill={C.sandDark} opacity={0.55} />
        <Path d={GRAIN.light} fill={C.sandLight} opacity={0.9} />

        {/* Wet sand just below the waterline */}
        <Path d={SHORE} fill="none" stroke={C.sandWet} strokeWidth={14} opacity={0.8} transform="translate(0 4)" />
      </G>

      {/* Ocean, its wave texture and glints */}
      <Path d={oceanPath} fill={`url(#ocean-${id})`} />
      <G clipPath={`url(#ocean-clip-${id})`}>
        <Path d={WAVES} fill="none" stroke={C.foam} strokeWidth={1.4} strokeLinecap="round" opacity={0.22} />
        <G fill={C.foam} opacity={0.7}>
          {GLINTS.map(([x, y, s]) => (
            <Path
              key={`${x}-${y}`}
              d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
            />
          ))}
        </G>
        {/* The next wave coming in */}
        <Path d={SHORE} fill="none" stroke={C.foam} strokeWidth={2} opacity={0.45} transform="translate(0 -14)" />
      </G>

      {/* Foam along the shoreline */}
      <Path d={SHORE} fill="none" stroke={C.foam} strokeWidth={6} strokeLinecap="round" opacity={0.92} />

      {/* The avatar's shadow on the sand, for depth */}
      <Ellipse cx={W / 2} cy={SEAM + AVATAR / 2 + 4} rx={40} ry={6} fill="#5A3E1E" opacity={0.22} />
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
  /** White on the water, with a soft shadow so it holds on the shallows */
  onWater: {
    color: C.onWater,
    textShadowColor: 'rgba(8, 50, 70, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dome: {
    position: 'absolute',
    top: SEAM - DOME_H + 2,
    left: (W - DOME_W) / 2,
  },
  medallion: {
    position: 'absolute',
    top: MEDAL_TOP,
    left: MEDAL_LEFT,
    width: MEDAL,
    height: MEDAL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  rating: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 22,
    lineHeight: 28,
  },
  tierText: {
    position: 'absolute',
    top: MEDAL_TOP + MEDAL + 3,
    left: MEDAL_LEFT,
    width: MEDAL,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  logo: {
    position: 'absolute',
    top: 16,
    right: 18,
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
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 28,
  },
  name: {
    position: 'absolute',
    top: SEAM + AVATAR / 2 + 10,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  handle: {
    position: 'absolute',
    top: SEAM + AVATAR / 2 + 40,
    left: 22,
    right: 22,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 13,
  },
  stats: {
    position: 'absolute',
    top: 330,
    left: 18,
    right: 18,
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    height: 62,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  /** Tier-metal strip along the tile's top edge */
  statStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
  },
  statValue: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 24,
    lineHeight: 30,
    maxWidth: 76,
  },
  chips: {
    position: 'absolute',
    top: 406,
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

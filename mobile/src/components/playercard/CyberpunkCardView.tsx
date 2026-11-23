import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { BDOME_LINE_ASPECT, BDomeLineArt } from './BDomeLineArt';
import { CardLogo } from './cardLogos';
import { PLAYER_CARD_HEIGHT, PLAYER_CARD_WIDTH, type PlayerCardViewProps } from './PlayerCardView';
import { FONT_FAMILIES } from '../../theme/typography';

/**
 * Cyberpunk-style player card, in the language of a neon-noir trading card box: acid-yellow ground
 * (faint grid, small crosses) in a chamfered black outline, a dark night-city panel with a faint cyan
 * grid and black slanted wedges bulging off its edges, the photo in a chamfered frame with a
 * cyan/red glitch offset, the BDome as a neon cyan skyline, the name as a glowing neon sign, and a
 * cyan label bar.
 *
 * Rating sits in a black badge top right, the logo top centre, stats in black on the yellow.
 * One palette in both themes. Same fixed size as every card style.
 */

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;
const CUT = 16;

const PANEL = { x: 14, y: 70, w: W - 28, h: 266, cut: 18 };
const PHOTO = { x: 84, y: 88, w: 132, h: 144, cut: 14 };
const DOME_W = 268;
const DOME_H = DOME_W / BDOME_LINE_ASPECT;
const NAME_TOP = 250;
const BAR_TOP = 356;
/** Cyan label bar */
const BAR = { w: 256, h: 30, cut: 10 };
/** How far the black wedges stick out of the panel; they lean like "\" */
const WEDGE = 18;
const PANEL_BOTTOM = PANEL.y + PANEL.h;
/** Wedges as [left x where they meet the panel, width]: two rising off the top, two hanging off the bottom */
const TOP_WEDGES = [
  [30, 48],
  [196, 56],
] as const;
const BOTTOM_WEDGES = [
  [40, 52],
  [196, 60],
] as const;
/** Faint grid on the yellow, with a small cross at every other intersection */
const GRID = 16;
/** The panel's own HUD grid (20px) and CRT scanlines (every 3px), each as one path */
const PANEL_GRID = [
  ...Array.from({ length: 14 }, (_, i) => `M${PANEL.x + i * 20} ${PANEL.y} V${PANEL_BOTTOM}`),
  ...Array.from({ length: 14 }, (_, i) => `M${PANEL.x} ${PANEL.y + i * 20} H${PANEL.x + PANEL.w}`),
].join(' ');
const SCANLINES = Array.from(
  { length: Math.ceil(PANEL.h / 3) },
  (_, i) => `M${PANEL.x} ${PANEL.y + i * 3 + 1.5} H${PANEL.x + PANEL.w}`,
).join(' ');

const C = {
  yellow: '#FCEE0A',
  black: '#0B0B0B',
  cyan: '#00F0FF',
  red: '#FF003C',
  /** Panel: teal-black sky, violet, then magenta-red neon at street level */
  panelTop: '#06161F',
  panelMid: '#1A0F33',
  panelLow: '#6A0B45',
  panelBottom: '#B0123F',
  magenta: '#C2187A',
  pink: '#FF2A9D',
  cyanSoft: '#7DF9FF',
  photoBg: '#14162A',
  inkMuted: '#2E2B05',
};

/** Rectangle with its top-left and bottom-right corners cut. */
function chamfer(x: number, y: number, w: number, h: number, c: number) {
  return `M${x + c} ${y} H${x + w} V${y + h - c} L${x + w - c} ${y + h} H${x} V${y + c} Z`;
}

/** The yellow's texture: hairline grid, and a small cross at every other intersection. */
function YellowGrid() {
  const cols = Math.floor(W / GRID);
  const rows = Math.floor(H / GRID);
  const lines = [
    ...Array.from({ length: cols }, (_, i) => `M${(i + 1) * GRID} 0 V${H}`),
    ...Array.from({ length: rows }, (_, i) => `M0 ${(i + 1) * GRID} H${W}`),
  ].join(' ');
  const crosses: string[] = [];
  for (let c = 2; c < cols; c += 2) {
    for (let r = 2; r < rows; r += 2) {
      const [x, y] = [c * GRID, r * GRID];
      crosses.push(`M${x - 2} ${y} H${x + 2} M${x} ${y - 2} V${y + 2}`);
    }
  }
  return (
    <G fill="none" stroke={C.black}>
      <Path d={lines} strokeWidth={0.5} opacity={0.05} />
      <Path d={crosses.join(' ')} strokeWidth={0.9} opacity={0.22} />
    </G>
  );
}

export function CyberpunkCardView(props: PlayerCardViewProps) {
  const id = React.useId().replace(/:/g, '');
  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const mains = props.interests.slice(0, 3);
  const panel = chamfer(PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.cut);
  const photo = chamfer(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.cut);

  return (
    <View style={styles.card} collapsable={false}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`night-${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.panelTop} />
            <Stop offset="0.45" stopColor={C.panelMid} />
            <Stop offset="0.78" stopColor={C.panelLow} />
            <Stop offset="1" stopColor={C.panelBottom} />
          </LinearGradient>
          <RadialGradient id={`bloom-${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.pink} stopOpacity={0.45} />
            <Stop offset="1" stopColor={C.pink} stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={`panel-${id}`}>
            <Path d={panel} />
          </ClipPath>
          <ClipPath id={`ground-${id}`}>
            <Path d={chamfer(3, 3, W - 6, H - 6, CUT - 1)} />
          </ClipPath>
        </Defs>

        {/* Black outline, yellow ground with its grid */}
        <Path d={chamfer(0, 0, W, H, CUT)} fill={C.black} />
        <Path d={chamfer(3, 3, W - 6, H - 6, CUT - 1)} fill={C.yellow} />
        <G clipPath={`url(#ground-${id})`}>
          <YellowGrid />
        </G>

        {/* Black wedges bulging out of the panel's top and bottom edges */}
        <G fill={C.black}>
          {TOP_WEDGES.map(([x, w]) => (
            <Path
              key={`t${x}`}
              d={`M${x} ${PANEL.y + 1} H${x + w} L${x + w - WEDGE} ${PANEL.y - WEDGE} H${x - WEDGE} Z`}
            />
          ))}
          {BOTTOM_WEDGES.map(([x, w]) => (
            <Path
              key={`b${x}`}
              d={`M${x} ${PANEL_BOTTOM - 1} H${x + w} L${x + w + WEDGE} ${PANEL_BOTTOM + WEDGE} H${x + WEDGE} Z`}
            />
          ))}
        </G>

        {/* Night-city panel: teal-black sky burning down into magenta-red neon */}
        <Path d={panel} fill={`url(#night-${id})`} />
        <G clipPath={`url(#panel-${id})`}>
          {/* Magenta bloom behind the portrait */}
          <Ellipse cx={W / 2} cy={PHOTO.y + PHOTO.h * 0.6} rx={150} ry={120} fill={`url(#bloom-${id})`} />

          {/* Faint HUD grid */}
          <Path d={PANEL_GRID} stroke={C.cyan} strokeWidth={0.6} opacity={0.08} fill="none" />

          {/* Neon screens low in the corners, like lit billboards */}
          <G>
            <Rect x={24} y={262} width={54} height={34} fill={C.magenta} opacity={0.55} />
            <Rect x={24} y={262} width={54} height={34} fill="none" stroke={C.pink} strokeWidth={1.2} opacity={0.9} />
            <Rect x={226} y={252} width={50} height={42} fill={C.magenta} opacity={0.5} />
            <Rect x={226} y={252} width={50} height={42} fill="none" stroke={C.pink} strokeWidth={1.2} opacity={0.9} />
          </G>

          {/* Thin vertical light strips */}
          <Rect x={46} y={96} width={2} height={120} fill={C.pink} opacity={0.8} />
          <Rect x={52} y={140} width={1} height={60} fill={C.pink} opacity={0.5} />
          <Rect x={254} y={104} width={2} height={128} fill={C.cyan} opacity={0.75} />

          {/* Scanlines over everything in the panel */}
          <Path d={SCANLINES} stroke="#000000" strokeWidth={1} opacity={0.18} fill="none" />
        </G>

        {/* HUD marks, top left */}
        <G stroke={C.black} strokeWidth={1.5} fill="none">
          <Rect x={20} y={16} width={9} height={9} />
          <Path d="M20 30 H29 M24.5 30 V38" />
          <Rect x={33} y={29} width={9} height={9} />
          <Path d="M33 29 L42 38" />
        </G>
      </Svg>

      {/* BDome as a neon sign: a wide soft glow under a bright line */}
      <View style={styles.dome} pointerEvents="none">
        <BDomeLineArt width={DOME_W} color={C.cyan} strokeWidth={7} opacity={0.1} />
      </View>
      <View style={styles.dome} pointerEvents="none">
        <BDomeLineArt width={DOME_W} color={C.cyanSoft} strokeWidth={2} opacity={0.5} />
      </View>

      {/* Photo: red and cyan glitch outlines pulled apart, the photo clipped to the frame, the frame */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <ClipPath id={`photo-${id}`}>
            <Path d={photo} />
          </ClipPath>
        </Defs>
        <Path d={photo} fill="none" stroke={C.red} strokeWidth={2} transform="translate(-4 3)" />
        <Path d={photo} fill="none" stroke={C.cyan} strokeWidth={2} transform="translate(4 -3)" />
        <Path d={photo} fill={C.photoBg} />
        {props.avatarUrl ? (
          <G clipPath={`url(#photo-${id})`}>
            <SvgImage
              href={{ uri: props.avatarUrl }}
              x={PHOTO.x}
              y={PHOTO.y}
              width={PHOTO.w}
              height={PHOTO.h}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        ) : null}
        <Path d={photo} fill="none" stroke={C.yellow} strokeWidth={2} />
      </Svg>
      {!props.avatarUrl && (
        <View style={styles.photo} pointerEvents="none">
          <Text style={styles.initials}>{initials || '?'}</Text>
        </View>
      )}

      {/* Logo, top centre */}
      <View style={styles.logo}>
        <CardLogo id={props.logo} height={40} />
      </View>

      {/* Rating badge, top right */}
      <View style={styles.badge}>
        <Text style={styles.badgeValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {props.rating.toLocaleString('en-IN')}
        </Text>
        <Text style={styles.badgeLabel}>RATING</Text>
      </View>

      {/* Name as a neon sign */}
      <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {props.fullName}
      </Text>

      {/* Cyan label bar: flat, square, top-right corner cut */}
      <View style={styles.bar}>
        <Svg width={BAR.w} height={BAR.h} style={StyleSheet.absoluteFill}>
          <Path
            d={`M0 0 H${BAR.w - BAR.cut} L${BAR.w} ${BAR.cut} V${BAR.h} H0 Z`}
            fill={C.cyan}
          />
        </Svg>
        <Text style={styles.barText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {`${props.tier.toUpperCase()} TIER  -  @${props.username}`}
        </Text>
      </View>

      {/* Stats on the yellow */}
      <View style={styles.stats}>
        <Stat value={props.events} label="EVENTS" />
        <Stat value={props.podiums} label="PODIUMS" />
        <Stat value={props.challenges} label="CHALL." />
        <Stat value={props.points ?? 0} label="POINTS" />
      </View>
      {mains.length > 0 && (
        <Text style={styles.mains} numberOfLines={1}>
          {mains.map((m) => m.toUpperCase()).join('  //  ')}
        </Text>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value.toLocaleString('en-IN')}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const slant = { transform: [{ skewX: '-8deg' }] };

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
  },
  dome: {
    position: 'absolute',
    top: PANEL.y + PANEL.h - DOME_H - 10,
    left: (W - DOME_W) / 2,
  },
  photo: {
    position: 'absolute',
    top: PHOTO.y,
    left: PHOTO.x,
    width: PHOTO.w,
    height: PHOTO.h,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 56,
    color: C.cyan,
    textShadowColor: C.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  logo: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 14,
    minWidth: 58,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: C.black,
    alignItems: 'center',
  },
  badgeValue: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 22,
    lineHeight: 24,
    color: C.yellow,
  },
  badgeLabel: {
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 8,
    letterSpacing: 1.2,
    color: C.yellow,
  },
  name: {
    ...slant,
    position: 'absolute',
    top: NAME_TOP,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 40,
    lineHeight: 46,
    color: '#B8FFF9',
    textShadowColor: C.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  bar: {
    position: 'absolute',
    top: BAR_TOP,
    left: (W - BAR.w) / 2,
    width: BAR.w,
    height: BAR.h,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BAR.cut + 4,
  },
  barText: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 15,
    letterSpacing: 1,
    color: C.black,
  },
  stats: {
    position: 'absolute',
    top: BAR_TOP + 38,
    left: 16,
    right: 16,
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...slant,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 30,
    lineHeight: 34,
    color: C.black,
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.inkMuted,
  },
  mains: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.inkMuted,
  },
});

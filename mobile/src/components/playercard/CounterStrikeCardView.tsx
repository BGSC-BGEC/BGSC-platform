import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { BDOME_LINE_ASPECT, BDomeLineArt } from './BDomeLineArt';
import { CardLogo } from './cardLogos';
import { PLAYER_CARD_HEIGHT, PLAYER_CARD_WIDTH, type PlayerCardViewProps } from './PlayerCardView';
import { FONT_FAMILIES } from '../../theme/typography';

/**
 * Counter-Strike-style player card. From the newer key art: a pale ground cut by bold orange
 * diagonal stripes, and heavy slanted caps. From the classic box art: the photo inside a round
 * emblem with a thick ring, and a black bar along the foot carrying the stats in orange caps.
 *
 * The tier is a rank: five chevrons beside the rating, filled up to the tier (Rookie 1 … Legend 5).
 * The BDome is dark line art in the pale ground, behind the emblem. One palette in both themes.
 */

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;
const R = 10;
const BORDER = 3;

const EMBLEM = { cx: W / 2, cy: 158, r: 76 };
const PHOTO_R = 60;
const DOME_W = 284;
const DOME_H = DOME_W / BDOME_LINE_ASPECT;
const NAME_TOP = 290;
const BAR_TOP = 384;

const TIERS = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Legend'];
const C = {
  ground: '#E9E8E4',
  orange: '#F08A24',
  orangeDeep: '#D9701A',
  ink: '#111111',
  inkMuted: '#4A4A48',
  bar: '#0E0E0E',
  barText: '#F5A623',
  barMuted: '#B5B5B0',
  ringDark: '#1A1A1A',
  photoBg: '#2B2B2A',
  chevronOff: '#C9C8C2',
};

/** A band along the stripes' diagonal (x = a − 0.6·y), `w` wide, across the card. */
function band(a: number, w: number) {
  const k = 0.6;
  return `M${a} 0 L${a + w} 0 L${a + w - k * H} ${H} L${a - k * H} ${H} Z`;
}

export function CounterStrikeCardView(props: PlayerCardViewProps) {
  const id = React.useId().replace(/:/g, '');
  const level = Math.max(0, TIERS.indexOf(props.tier)) + 1;
  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const mains = props.interests.slice(0, 3);

  return (
    <View style={styles.card} collapsable={false}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={`inner-${id}`}>
            <Rect x={BORDER} y={BORDER} width={W - BORDER * 2} height={H - BORDER * 2} rx={R - BORDER} />
          </ClipPath>
        </Defs>

        <Rect x={0} y={0} width={W} height={H} rx={R} fill={C.ink} />
        <G clipPath={`url(#inner-${id})`}>
          <Rect x={0} y={0} width={W} height={H} fill={C.ground} />

          {/* Orange stripes sweeping down-left: one broad band and its thin echoes */}
          <Path d={band(300, 96)} fill={C.orange} />
          <Path d={band(412, 26)} fill={C.orange} />
          <Path d={band(448, 8)} fill={C.orangeDeep} />
          <Path d={band(276, 6)} fill={C.orange} opacity={0.8} />
          <Path d={band(262, 3)} fill={C.orange} opacity={0.5} />

          {/* Black bar along the foot, with an orange rule on top */}
          <Rect x={0} y={BAR_TOP} width={W} height={H - BAR_TOP} fill={C.bar} />
          <Rect x={0} y={BAR_TOP} width={W} height={3} fill={C.orange} />
        </G>
      </Svg>

      {/* BDome in the pale ground, behind the emblem */}
      <View style={styles.dome} pointerEvents="none">
        <BDomeLineArt width={DOME_W} color={C.ink} strokeWidth={2.2} opacity={0.22} />
      </View>

      {/* Emblem: crosshair ticks round it, dark ring, thick orange ring, then the photo */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Bullet holes in the wall */}
        <BulletHole x={186} y={54} />
        <BulletHole x={262} y={252} s={0.8} />
        <BulletHole x={30} y={266} s={0.7} />


        <G stroke={C.ink} strokeWidth={3} strokeLinecap="square">
          {[0, 90, 180, 270].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const [r1, r2] = [EMBLEM.r + 5, EMBLEM.r + 15];
            return (
              <Path
                key={deg}
                d={`M${EMBLEM.cx + r1 * Math.sin(a)} ${EMBLEM.cy - r1 * Math.cos(a)} L${EMBLEM.cx + r2 * Math.sin(a)} ${EMBLEM.cy - r2 * Math.cos(a)}`}
              />
            );
          })}
        </G>
        <Circle cx={EMBLEM.cx} cy={EMBLEM.cy} r={EMBLEM.r} fill={C.ringDark} />
        <Circle cx={EMBLEM.cx} cy={EMBLEM.cy} r={EMBLEM.r - 4} fill={C.orange} />
        <Circle cx={EMBLEM.cx} cy={EMBLEM.cy} r={PHOTO_R + 3} fill={C.ringDark} />
      </Svg>
      <View style={styles.photo}>
        {props.avatarUrl ? (
          <Image source={{ uri: props.avatarUrl }} style={styles.photoImg} />
        ) : (
          <Text style={styles.initials}>{initials || '?'}</Text>
        )}
      </View>

      {/* Rating and rank, top left */}
      <View style={styles.ratingBlock}>
        <Text style={styles.rating} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {props.rating.toLocaleString('en-IN')}
        </Text>
        <View style={styles.rankRow}>
          <Chevrons level={level} />
          <Text style={styles.rankText}>{props.tier.toUpperCase()}</Text>
        </View>
      </View>

      {/* Logo, top right */}
      <View style={styles.logo}>
        <CardLogo id={props.logo} height={40} />
      </View>

      {/* Identity */}
      <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {props.fullName.toUpperCase()}
      </Text>
      <Text style={styles.handle} numberOfLines={1}>
        @{props.username}
      </Text>

      {/* Stats in the bar */}
      <View style={styles.stats}>
        <Stat value={props.events} label="EVENTS" />
        <Stat value={props.podiums} label="PODIUMS" />
        <Stat value={props.challenges} label="CHALL." />
        <Stat value={props.points ?? 0} label="POINTS" />
      </View>
      {mains.length > 0 && (
        <Text style={styles.mains} numberOfLines={1}>
          {mains.map((m) => m.toUpperCase()).join('  /  ')}
        </Text>
      )}
    </View>
  );
}

/** A bullet hole: dark core, scorched ring, a few cracks. */
function BulletHole({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Circle cx={0} cy={0} r={7} fill={C.ink} opacity={0.12} />
      <Path
        d="M3 -3 L11 -9 M4 2 L12 5 M-1 4 L-4 13 M-4 -2 L-12 -4 M0 -4 L-2 -12"
        stroke={C.ink}
        strokeWidth={0.9}
        opacity={0.45}
      />
      <Circle cx={0} cy={0} r={3.4} fill={C.ink} />
      <Circle cx={-0.8} cy={-0.8} r={1.2} fill="#3A3A38" />
    </G>
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

/** Five rank chevrons, filled up to `level`. */
function Chevrons({ level }: { level: number }) {
  return (
    <Svg width={5 * 9 + 4} height={12} viewBox="0 0 49 12">
      {TIERS.map((_, i) => (
        <Path
          key={i}
          d={`M${i * 9} 0 L${i * 9 + 5} 0 L${i * 9 + 10} 6 L${i * 9 + 5} 12 L${i * 9} 12 L${i * 9 + 5} 6 Z`}
          fill={i < level ? C.orange : C.chevronOff}
        />
      ))}
    </Svg>
  );
}

/** Heavy caps leaning forward, like the game's wordmark. */
const slant = { transform: [{ skewX: '-10deg' }] };

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
  },
  dome: {
    position: 'absolute',
    top: NAME_TOP - DOME_H + 30,
    left: (W - DOME_W) / 2,
  },
  photo: {
    position: 'absolute',
    top: EMBLEM.cy - PHOTO_R,
    left: EMBLEM.cx - PHOTO_R,
    width: PHOTO_R * 2,
    height: PHOTO_R * 2,
    borderRadius: PHOTO_R,
    overflow: 'hidden',
    backgroundColor: C.photoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  initials: {
    ...slant,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 54,
    color: C.orange,
  },
  ratingBlock: {
    position: 'absolute',
    top: 14,
    left: 18,
    maxWidth: 110,
  },
  rating: {
    ...slant,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 46,
    lineHeight: 50,
    color: C.ink,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -2,
  },
  rankText: {
    ...slant,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 12,
    letterSpacing: 1.2,
    color: C.inkMuted,
  },
  logo: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  name: {
    ...slant,
    position: 'absolute',
    top: NAME_TOP,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: 0.5,
    color: C.ink,
  },
  handle: {
    position: 'absolute',
    top: NAME_TOP + 48,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 15,
    letterSpacing: 0.6,
    color: C.inkMuted,
  },
  stats: {
    position: 'absolute',
    top: BAR_TOP + 14,
    left: 14,
    right: 14,
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
    color: C.barText,
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.barMuted,
  },
  mains: {
    position: 'absolute',
    bottom: 14,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.barMuted,
  },
});

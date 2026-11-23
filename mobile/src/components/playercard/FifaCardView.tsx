import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { BDOME_LINE_ASPECT, BDomeLineArt } from './BDomeLineArt';
import { CardLogo } from './cardLogos';
import { cardTierStyle } from './cardTiers';
import { PLAYER_CARD_HEIGHT, PLAYER_CARD_WIDTH, type PlayerCardViewProps } from './PlayerCardView';
import { FONT_FAMILIES } from '../../theme/typography';

/**
 * FIFA-style player card, in the shape of a football ultimate-team card: a shield with a peaked
 * top, curved shoulders and a pointed foot. Black faceted body, the photo in a metal-framed window
 * (uploads come with any background), the BDome in metal line art beneath it, behind the name.
 *
 * Left column: rating, tier, chosen logo. Below the full name, a 2×2 stat block; the handle sits
 * small in the foot. The tier is the metal:
 * border, lettering and hairlines all take the tier's foil, the way the game's gold, silver and
 * bronze cards do. Transparent outside the shield, so the shared PNG keeps the shape.
 */

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;

/** The shield, inside an 8px margin so the border stroke fits the canvas. */
const SHIELD = [
  'M8 66',
  'Q30 58 36 28', // left shoulder, concave
  'L118 22',
  'Q140 20 150 6', // peak
  'Q160 20 182 22',
  'L264 28',
  'Q270 58 292 66', // right shoulder
  'V394',
  'L180 462',
  'Q150 482 120 462', // the foot
  'L8 394 Z',
].join(' ');

/**
 * Photo window, right of the left column. Framed rather than bled into the card: uploads come with
 * any background, and a frame makes every one of them read as a portrait. The frame is a small
 * echo of the card itself: chamfered shoulders, a peak at the top, a pointed foot.
 */
const PHOTO = { x: 112, y: 60, w: 150, h: 160 };
const PHOTO_FRAME = (() => {
  const { x, y, w, h } = PHOTO;
  const m = x + w / 2;
  return [
    `M${x} ${y + 16}`,
    `L${x + 16} ${y + 6} H${m - 16} L${m} ${y} L${m + 16} ${y + 6} H${x + w - 16} L${x + w} ${y + 16}`,
    `V${y + h - 26} L${m} ${y + h} L${x} ${y + h - 26} Z`,
  ].join(' ');
})();
/** Inner hairline: the frame shrunk about its centre. */
const PHOTO_INNER = `translate(${PHOTO.x + PHOTO.w / 2} ${PHOTO.y + PHOTO.h / 2}) scale(0.92) translate(${-(PHOTO.x + PHOTO.w / 2)} ${-(PHOTO.y + PHOTO.h / 2)})`;
const DOME_W = 270;
const DOME_H = DOME_W / BDOME_LINE_ASPECT;
const NAME_TOP = 300;
/** Left column top: below the shoulder curve, which cuts in above ~y 66. */
const COL_TOP = 74;
/** The BDome stands just under the frame and runs behind the name. */
const DOME_TOP = PHOTO.y + PHOTO.h + 6;

const C = {
  bodyTop: '#1C1B19',
  bodyBottom: '#0A0A0A',
  photoBg: '#24231F',
  initials: '#4A4840',
};

export function FifaCardView(props: PlayerCardViewProps) {
  const t = cardTierStyle(props.tier, 'dark');
  // Light end of the tier's metal for lettering; full foil for the border.
  const ink = t.foil[1];
  const id = React.useId().replace(/:/g, '');
  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    <View style={styles.card} collapsable={false}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`foil-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.foil[0]} />
            <Stop offset="0.45" stopColor={t.foil[1]} />
            <Stop offset="0.55" stopColor={t.foil[1]} />
            <Stop offset="1" stopColor={t.foil[2]} />
          </LinearGradient>
          <LinearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.bodyTop} />
            <Stop offset="1" stopColor={C.bodyBottom} />
          </LinearGradient>
          <ClipPath id={`shield-${id}`}>
            <Path d={SHIELD} />
          </ClipPath>
          <ClipPath id={`photo-${id}`}>
            <Path d={PHOTO_FRAME} />
          </ClipPath>
          <ClipPath id={`above-${id}`}>
            <Rect x={0} y={0} width={W} height={DOME_TOP} />
          </ClipPath>
        </Defs>

        <G clipPath={`url(#shield-${id})`}>
          <Rect x={0} y={0} width={W} height={H} fill={`url(#body-${id})`} />

          {/* Above the BDome only: nothing in the background crosses it */}
          <G clipPath={`url(#above-${id})`}>
            {/* Stadium spotlights fanning down from the peak */}
            <G fill={ink} opacity={0.05}>
              <Path d="M150 6 L60 480 L100 480 Z" />
              <Path d="M150 6 L135 480 L165 480 Z" />
              <Path d="M150 6 L200 480 L240 480 Z" />
            </G>

            {/* Faceted lines, like cut crystal behind the player */}
            <Path
              d="M8 140 L120 60 L292 170 M60 30 L200 260 L292 120 M150 6 L90 220 L8 250"
              fill="none"
              stroke={ink}
              strokeWidth={0.8}
              opacity={0.07}
            />
          </G>

          {/* The pitch's two penalty boxes with their arcs, one at each end, clear of the BDome */}
          <G fill="none" stroke={ink} strokeWidth={1} opacity={0.09}>
            {/* Top end */}
            <Rect x={70} y={0} width={160} height={64} />
            <Rect x={112} y={0} width={76} height={24} />
            <Path d="M122 64 A34 34 0 0 0 178 64" />
            {/* Bottom end */}
            <Rect x={70} y={410} width={160} height={70} />
            <Rect x={112} y={452} width={76} height={28} />
            <Path d="M122 410 A34 34 0 0 1 178 410" />
          </G>
        </G>

        {/* Photo in its frame: backing for transparent or missing photos, then the photo */}
        <Path d={PHOTO_FRAME} fill={C.photoBg} />
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
        <Path d={PHOTO_FRAME} fill="none" stroke={`url(#foil-${id})`} strokeWidth={3} strokeLinejoin="round" />
        <Path
          d={PHOTO_FRAME}
          transform={PHOTO_INNER}
          fill="none"
          stroke={ink}
          strokeWidth={0.8}
          opacity={0.5}
        />

        {/* Border: the tier's metal, with a fine inner line */}
        <Path d={SHIELD} fill="none" stroke={`url(#foil-${id})`} strokeWidth={6} />
        <Path
          d={SHIELD}
          fill="none"
          stroke={ink}
          strokeWidth={1}
          opacity={0.55}
          transform="translate(150 244) scale(0.94) translate(-150 -244)"
        />

        {/* Hairlines: left column, under the name, the stat divider, above the foot */}
        <G fill={ink} opacity={0.6}>
          <Rect x={30} y={COL_TOP + 88} width={44} height={1} />
          <Rect x={30} y={COL_TOP + 146} width={44} height={1} />
          <Rect x={44} y={NAME_TOP + 48} width={212} height={1} />
          <Rect x={150} y={NAME_TOP + 60} width={1} height={62} />
          <Rect x={124} y={NAME_TOP + 128} width={52} height={1} />
        </G>
      </Svg>

      {/* No photo: big initials in the frame */}
      {!props.avatarUrl && (
        <View style={styles.initialsBox} pointerEvents="none">
          <Text style={[styles.initials, { color: C.initials }]}>{initials || '?'}</Text>
        </View>
      )}

      {/* BDome under the frame, behind the name */}
      <View style={styles.dome} pointerEvents="none">
        <BDomeLineArt width={DOME_W} color={ink} strokeWidth={2} opacity={0.32} />
      </View>

      {/* Left column: rating, tier, logo */}
      <View style={styles.leftCol}>
        <Text style={[styles.rating, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {props.rating}
        </Text>
        <Text style={[styles.tier, { color: ink }]}>{t.label.toUpperCase()}</Text>
      </View>
      <View style={styles.logo}>
        <CardLogo id={props.logo} height={34} />
      </View>

      {/* Name */}
      <Text style={[styles.name, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {props.fullName.toUpperCase()}
      </Text>

      {/* Stats, two by two */}
      <View style={styles.stats}>
        <View style={styles.statCol}>
          <Stat value={props.events} label="EVT" ink={ink} />
          <Stat value={props.podiums} label="POD" ink={ink} />
        </View>
        <View style={styles.statCol}>
          <Stat value={props.challenges} label="CHL" ink={ink} />
          <Stat value={props.points ?? 0} label="PTS" ink={ink} />
        </View>
      </View>

      {/* Foot: the handle */}
      <Text style={[styles.foot, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        @{props.username}
      </Text>
    </View>
  );
}

function Stat({ value, label, ink }: { value: number; label: string; ink: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: ink }]} numberOfLines={1}>
        {value.toLocaleString('en-IN')}
      </Text>
      <Text style={[styles.statLabel, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
  },
  initialsBox: {
    position: 'absolute',
    top: PHOTO.y,
    left: PHOTO.x,
    width: PHOTO.w,
    height: PHOTO.h,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 84,
    lineHeight: 92,
  },
  dome: {
    position: 'absolute',
    top: DOME_TOP,
    left: (W - DOME_W) / 2,
  },
  leftCol: {
    position: 'absolute',
    top: COL_TOP,
    left: 22,
    width: 60,
    alignItems: 'center',
  },
  rating: {
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 58,
    lineHeight: 60,
  },
  tier: {
    marginTop: -2,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 18,
    letterSpacing: 1,
  },
  logo: {
    position: 'absolute',
    top: COL_TOP + 100,
    left: 22,
    width: 60,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    position: 'absolute',
    top: NAME_TOP + 6,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: 1,
  },
  stats: {
    position: 'absolute',
    top: NAME_TOP + 58,
    left: 40,
    right: 40,
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statValue: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 26,
    lineHeight: 30,
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 18,
    lineHeight: 30,
    letterSpacing: 0.5,
  },
  // Tucked right under the hairline: the shield narrows fast towards the foot, and at this
  // height the inner line leaves ~108px (96–204).
  foot: {
    position: 'absolute',
    top: NAME_TOP + 131,
    left: 96,
    right: 96,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
});

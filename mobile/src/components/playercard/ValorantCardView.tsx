import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CardLogo } from './cardLogos';
import { BDOME_LINE_ASPECT, BDomeLineArt } from './BDomeLineArt';
import { cardTierStyle } from './cardTiers';
import { PLAYER_CARD_HEIGHT, PLAYER_CARD_WIDTH, type PlayerCardViewProps } from './PlayerCardView';
import { FONT_FAMILIES } from '../../theme/typography';

/**
 * Valorant-style player card, in the design language of a Valorant agent card: an off-white upper panel
 * with the name ghosted behind, tier emblem and BGSC crest across the top, the avatar standing over
 * the BDome line art, red dash accents, then a notched dark lower panel with the full name in
 * condensed caps, the handle, a red points pill, stats and mains.
 *
 * One palette in both themes (the look is the style). The tier shows in the metal border, the
 * emblem and the pill beside the handle. Same fixed size as every card style, so profile, landing
 * and share all fit it.
 */

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;

/** Where the dark panel starts; the wordmark tab rises above it. */
const SEAM = 272;
const TAB = 14;
const CUT = 18;
/** Tier metal border width */
const B = 4;
/** Outer and inner corner radii */
const R = 10;
const RI = R - B;
const AVATAR = 104;
const FRAME_PAD = 6;
const DOME_W = 290;
const DOME_H = DOME_W / BDOME_LINE_ASPECT;

const C = {
  paper: '#ECE8E1',
  night: '#0F1923',
  red: '#FF4655',
  /** Body text on night (≥ 4.5:1) */
  ash: '#A3ACB1',
  /** Small text on paper (≥ 4.5:1) */
  slate: '#4D565E',
  white: '#FFFFFF',
};

export function ValorantCardView(props: PlayerCardViewProps) {
  const tier = cardTierStyle(props.tier, 'dark');
  const id = React.useId().replace(/:/g, '');
  const name = props.fullName.toUpperCase();
  const initials = props.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const mains = props.interests.slice(0, 3);

  return (
    <View style={styles.card} collapsable={false}>
      <Backdrop id={id} foil={tier.foil} />

      {/* Name ghosted behind everything, three rows like stencilled crates */}
      <View style={styles.ghost} pointerEvents="none">
        {[0.09, 0.055, 0.035].map((o, i) => (
          <Text key={i} style={[styles.ghostText, { opacity: o }]} numberOfLines={1}>
            {name || 'BGSC'}
          </Text>
        ))}
      </View>

      {/* BDome, standing on the seam */}
      <View style={styles.dome} pointerEvents="none">
        <BDomeLineArt width={DOME_W} color={C.night} strokeWidth={2.4} opacity={0.42} />
      </View>

      {/* Tier emblem, top left */}
      <View style={styles.emblem}>
        <TierEmblem id={id} foil={tier.foil} />
        <Text style={styles.emblemText}>{tier.label.toUpperCase()}</Text>
      </View>

      {/* Chosen logo, top right */}
      <View style={styles.brand}>
        <CardLogo id={props.logo} height={44} />
      </View>

      {/* Avatar in front of the portal */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          {props.avatarUrl ? (
            <Image source={{ uri: props.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.initials}>{initials || '?'}</Text>
          )}
        </View>
        <AvatarFrame />
      </View>

      {/* Label in the tab */}
      <Text style={styles.tabLabel}>PLAYER CARD</Text>

      {/* Identity: full name big, handle beneath */}
      <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {name}
      </Text>
      <View style={styles.subline}>
        <Text style={styles.handle} numberOfLines={1}>
          @{props.username.toUpperCase()}
        </Text>
        <View style={[styles.tierPill, { backgroundColor: tier.heroAccent }]}>
          <Text style={styles.tierPillText}>{tier.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* Points, in the red pill */}
      <View style={styles.pointsRow}>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsLabel}>POINTS</Text>
          <Text style={styles.pointsValue}>{(props.points ?? 0).toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Stat label="EVENTS" value={props.events} />
        <Stat label="PODIUMS" value={props.podiums} />
        <Stat label="CHALLENGES" value={props.challenges} />
      </View>

      {/* Mains */}
      {mains.length > 0 && (
        <Text style={styles.mains} numberOfLines={1}>
          <Text style={styles.mainsLabel}>MAINS  </Text>
          {mains.map((m) => m.toUpperCase()).join('  /  ')}
        </Text>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Dashes />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString('en-IN')}</Text>
    </View>
  );
}

/** The short red double dash used as a section marker. */
function Dashes() {
  return (
    <View style={styles.dashes}>
      <View style={[styles.dash, { width: 14 }]} />
      <View style={[styles.dash, { width: 5 }]} />
    </View>
  );
}

/**
 * Tier metal border, paper upper panel, notched night lower panel with a cut corner, and the red
 * accents. The border is the whole card shape in foil; the panels sit inset by B on top of it.
 */
function Backdrop({ id, foil }: { id: string; foil: [string, string, string] }) {
  const mid = W / 2;
  const tabHalf = 54;
  // The inner cut sits B in from the outer one along the 45° edge.
  const cutIn = CUT - B * (Math.SQRT2 - 1);
  const outer = [
    `M${R} 0 H${W - R} Q${W} 0 ${W} ${R}`,
    `V${H - CUT} L${W - CUT} ${H}`,
    `H${R} Q0 ${H} 0 ${H - R}`,
    `V${R} Q0 0 ${R} 0 Z`,
  ].join(' ');
  const paper = [
    `M${B} ${SEAM} V${B + RI} Q${B} ${B} ${B + RI} ${B}`,
    `H${W - B - RI} Q${W - B} ${B} ${W - B} ${B + RI} V${SEAM} Z`,
  ].join(' ');
  const night = [
    `M${B} ${SEAM}`,
    `H${mid - tabHalf - TAB}`,
    `L${mid - tabHalf} ${SEAM - TAB}`,
    `H${mid + tabHalf}`,
    `L${mid + tabHalf + TAB} ${SEAM}`,
    `H${W - B}`,
    `V${H - B - cutIn}`,
    `L${W - B - cutIn} ${H - B}`,
    `H${B + RI} Q${B} ${H - B} ${B} ${H - B - RI} Z`,
  ].join(' ');

  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`border-${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={foil[0]} />
          <Stop offset="0.45" stopColor={foil[1]} />
          <Stop offset="0.55" stopColor={foil[1]} />
          <Stop offset="1" stopColor={foil[2]} />
        </LinearGradient>
      </Defs>
      <Path d={outer} fill={`url(#border-${id})`} />
      <Path d={paper} fill={C.paper} />
      <Path d={night} fill={C.night} />

      {/* Red dashes off the edges, as on a field kit */}
      <G fill={C.red}>
        <Rect x={B} y={96} width={22} height={3} />
        <Rect x={B + 26} y={96} width={8} height={3} />
        <Rect x={W - B - 22} y={64} width={22} height={3} />
        <Rect x={W - B - 34} y={64} width={8} height={3} />
        {/* Along the seam, either side of the tab */}
        <Rect x={16} y={SEAM} width={44} height={2} />
        <Rect x={W - 60} y={SEAM} width={44} height={2} />
      </G>

      {/* Hairline ticks on the paper, near the seam */}
      <G fill={C.night} opacity={0.3}>
        <Rect x={16} y={SEAM - 22} width={22} height={1} />
        <Rect x={16} y={SEAM - 17} width={12} height={1} />
        <Rect x={W - 38} y={SEAM - 22} width={22} height={1} />
        <Rect x={W - 28} y={SEAM - 17} width={12} height={1} />
      </G>
    </Svg>
  );
}

/** Night outline with cut corners and red corner brackets, laid over the avatar square. */
function AvatarFrame() {
  const a = AVATAR;
  const p = FRAME_PAD; // room outside the square for the brackets, which an Svg would clip
  const k = 14; // corner cut
  const outline = `M${p + k} ${p + 1} H${p + a - 1} V${p + a - k} L${p + a - k} ${p + a - 1} H${p + 1} V${p + k} Z`;
  return (
    <Svg width={a + p * 2} height={a + p * 2} style={styles.frame}>
      {/* Paper triangles hide the photo in the cut corners */}
      <Path d={`M${p} ${p} H${p + k} L${p} ${p + k} Z`} fill={C.paper} />
      <Path d={`M${p + a} ${p + a} H${p + a - k} L${p + a} ${p + a - k} Z`} fill={C.paper} />
      <Path d={outline} fill="none" stroke={C.night} strokeWidth={2} />
      <Path d={`M${a - 12 + p} 2 H${a + p * 2 - 2} V${p + 14}`} fill="none" stroke={C.red} strokeWidth={3} />
      <Path d={`M2 ${a + p - 14} V${a + p * 2 - 2} H${p + 12}`} fill="none" stroke={C.red} strokeWidth={3} />
    </Svg>
  );
}

/** A diamond in the tier's metal inside a night diamond, like a rank badge. */
function TierEmblem({ id, foil }: { id: string; foil: [string, string, string] }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34">
      <Defs>
        <LinearGradient id={`emblem-${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={foil[0]} />
          <Stop offset="0.5" stopColor={foil[1]} />
          <Stop offset="1" stopColor={foil[2]} />
        </LinearGradient>
      </Defs>
      <Path d="M17 1 L33 17 L17 33 L1 17 Z" fill={C.night} />
      <Path d="M17 7 L27 17 L17 27 L7 17 Z" fill={`url(#emblem-${id})`} />
      <Path d="M17 11 L23 17 L17 23 L11 17 Z" fill="none" stroke={C.night} strokeWidth={1.2} opacity={0.6} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
    borderRadius: R,
    overflow: 'hidden',
  },
  // Clipped to the paper panel so the ghosted name never runs over the tier border.
  ghost: {
    position: 'absolute',
    top: B,
    left: B,
    right: B,
    height: SEAM - B,
    overflow: 'hidden',
  },
  ghostText: {
    width: W + 300, // wide enough that a long name runs off the edge instead of wrapping
    marginLeft: -6,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 84,
    lineHeight: 74,
    color: C.night,
    letterSpacing: -1,
  },
  dome: {
    position: 'absolute',
    top: SEAM - DOME_H + 2,
    left: (W - DOME_W) / 2,
  },
  emblem: {
    position: 'absolute',
    top: 16,
    left: 16,
    alignItems: 'center',
  },
  emblemText: {
    marginTop: 3,
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.slate,
  },
  brand: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  avatarWrap: {
    position: 'absolute',
    // Just above the dome: it stands over the cap while the BDome stays readable beneath.
    top: 42,
    left: (W - AVATAR) / 2,
    width: AVATAR,
    height: AVATAR,
  },
  avatar: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    backgroundColor: '#D9D3C9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    top: -FRAME_PAD,
    left: -FRAME_PAD,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 44,
    color: C.night,
  },
  tabLabel: {
    position: 'absolute',
    top: SEAM - TAB + 2,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 3,
    color: C.red,
  },
  name: {
    position: 'absolute',
    top: SEAM + 8,
    left: 18,
    right: 18,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: 0.5,
    color: C.white,
  },
  subline: {
    position: 'absolute',
    top: SEAM + 50,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  handle: {
    flexShrink: 1,
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 12,
    letterSpacing: 1.4,
    color: C.ash,
  },
  tierPill: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tierPillText: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 10,
    letterSpacing: 1,
    color: C.night,
  },
  pointsRow: {
    position: 'absolute',
    top: SEAM + 74,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 26,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: C.red,
  },
  pointsLabel: {
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 11,
    letterSpacing: 1.6,
    color: C.white,
  },
  pointsValue: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 17,
    lineHeight: 20,
    color: C.white,
  },
  stats: {
    position: 'absolute',
    top: SEAM + 116,
    left: 20,
    right: 20,
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
  },
  dashes: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 5,
  },
  dash: {
    height: 3,
    backgroundColor: C.red,
  },
  statLabel: {
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.ash,
  },
  statValue: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    fontSize: 30,
    lineHeight: 32,
    color: C.white,
  },
  mains: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 34,
    fontFamily: FONT_FAMILIES.condensed,
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.ash,
  },
  mainsLabel: {
    fontFamily: FONT_FAMILIES.condensedHeavy,
    color: C.red,
  },
});

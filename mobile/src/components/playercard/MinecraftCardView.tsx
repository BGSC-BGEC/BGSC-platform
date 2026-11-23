import React from 'react';
import { Image, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { BDOME_LINE_ASPECT } from './BDomeLineArt';
import { PixelBDome } from './PixelBDome';
import { CardLogo } from './cardLogos';
import { PLAYER_CARD_HEIGHT, PLAYER_CARD_WIDTH, type PlayerCardViewProps } from './PlayerCardView';
import { useFonts, PixelifySans_500Medium, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';

/** Blocky pixel type, used only on this card, so it is loaded here rather than app-wide. */
const PIXEL = 'PixelifySans_500Medium';
const PIXEL_BOLD = 'PixelifySans_700Bold';

/**
 * Minecraft-style player card: the whole card is a grass block side (grass dripping into speckled
 * dirt), with stepped pixel corners. The rating is an outlined XP-green level in the top-left
 * corner, the logo in the corner opposite, the photo hangs in a wooden item frame in front of the
 * BDome (carved into the dirt as background), the name is on a chat-style strip, and the stats are
 * a four-slot hotbar.
 *
 * The tier is an ore: stone, copper, iron, gold, diamond for Rookie to Legend, in the border and the
 * tier text. One palette in both themes. Same fixed size as every card style.
 */

const W = PLAYER_CARD_WIDTH;
const H = PLAYER_CARD_HEIGHT;

/** Texture pixel size; the card is 25 × 40 of them. */
const P = 12;
const COLS = W / P;
const ROWS = H / P;
/** Stepped-corner size, in points */
const STEP = 6;
/** Outline + ore border */
const OUTLINE = 3;
const ORE_W = 5;
const INSET = OUTLINE + ORE_W;

const STRIP_TOP = 286;
/** The BDome is background: carved into the dirt, standing just above the name strip. */
const DOME_W = 276;
const DOME_H = DOME_W / BDOME_LINE_ASPECT;
/** Pixel size of the BDome's blocks */
const DOME_CELL = 3;
// Sits low: its base runs a little under the see-through name strip, as background. Snapped to the
// dome's cell grid so the blocks stay crisp.
const DOME_TOP = Math.round((STRIP_TOP + 24 - DOME_H) / DOME_CELL) * DOME_CELL;
/** Item frame: centred, in front of the dome's upper part, the player standing over the BDome. */
const FRAME = { x: 90, y: 84, size: 120, wood: 9 };
/** Rating font size by digit count: the column beside the frame is ~66 wide. */
const RATING_SIZE: Record<number, number> = { 1: 34, 2: 34, 3: 28, 4: 22 };

const C = {
  outline: '#1B1B1B',
  xp: '#80FF20',
  text: '#FFFFFF',
  textMuted: '#E0E0E0',
  shadow: '#3F3F3F',
  slot: '#8B8B8B',
  slotDark: '#373737',
  slotLight: '#FFFFFF',
  wood: '#9C6B3C',
  woodDark: '#6E4824',
  woodLight: '#B9844F',
  photoBg: '#5E4130',
  /** Carved BDome: groove and the lit lip below it */
  carve: '#2E1F14',
  carveLip: '#B98A5E',
};

/** The tier as an ore: face colour and its shade. */
const ORES: Record<string, { face: string; shade: string }> = {
  Rookie: { face: '#A0A0A0', shade: '#6B6B6B' }, // stone
  Bronze: { face: '#D9804F', shade: '#9C4F2A' }, // copper
  Silver: { face: '#E8E8E8', shade: '#A8A8A8' }, // iron
  Gold: { face: '#FCE34A', shade: '#C8A228' },
  Legend: { face: '#5DECF5', shade: '#2BA5AD' }, // diamond
};

const GRASS = ['#5D9B3A', '#6DB33F', '#4E8A2E', '#79C04A'];
const DIRT_BASE = '#866043';
const DIRT = ['#866043', '#79553A', '#966C4A', '#5E4130', '#866043', '#9F7550'];

/** Rectangle with pixel-stepped corners. */
function stepped(x: number, y: number, w: number, h: number, s: number) {
  return [
    `M${x + s} ${y} H${x + w - s} V${y + s} H${x + w} V${y + h - s} H${x + w - s} V${y + h}`,
    `H${x + s} V${y + h - s} H${x} V${y + s} H${x + s} Z`,
  ].join(' ');
}

/**
 * The grass block texture, built once: a seeded PRNG so every card (and every render) gets the
 * same blocks. Same-colour runs in a row merge into one rect to keep the SVG light.
 */
const TEXTURE = (() => {
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const grassDepth = Array.from({ length: COLS }, () => 3 + Math.floor(rand() * 3));
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  for (let r = 0; r < ROWS; r++) {
    let run: { x: number; y: number; w: number; fill: string } | null = null;
    for (let c = 0; c < COLS; c++) {
      const fill = r < grassDepth[c]! ? GRASS[Math.floor(rand() * GRASS.length)]! : DIRT[Math.floor(rand() * DIRT.length)]!;
      if (run && run.fill === fill) run.w += P;
      else {
        if (run && run.fill !== DIRT_BASE) runs.push(run);
        run = { x: c * P, y: r * P, w: P, fill };
      }
    }
    if (run && run.fill !== DIRT_BASE) runs.push(run);
  }
  return runs;
})();

export function MinecraftCardView(props: PlayerCardViewProps) {
  // Text falls back to the system font for the moment the pixel font is loading.
  useFonts({ PixelifySans_500Medium, PixelifySans_700Bold });
  const ore = ORES[props.tier] ?? ORES.Rookie!;
  const id = React.useId().replace(/:/g, '');
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
            <Path d={stepped(INSET, INSET, W - INSET * 2, H - INSET * 2, STEP)} />
          </ClipPath>
        </Defs>

        {/* Outline, then the ore border with a shaded inner edge */}
        <Path d={stepped(0, 0, W, H, STEP)} fill={C.outline} />
        <Path d={stepped(OUTLINE, OUTLINE, W - OUTLINE * 2, H - OUTLINE * 2, STEP)} fill={ore.face} />
        <Path d={stepped(INSET - 2, INSET - 2, W - (INSET - 2) * 2, H - (INSET - 2) * 2, STEP)} fill={ore.shade} />

        {/* Grass block */}
        <G clipPath={`url(#inner-${id})`}>
          <Rect x={0} y={0} width={W} height={H} fill={DIRT_BASE} />
          {TEXTURE.map((r) => (
            <Rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={P} fill={r.fill} />
          ))}
          {/* Chat-style strip behind the name */}
          <Rect x={0} y={STRIP_TOP} width={W} height={70} fill="#000000" opacity={0.5} />
        </G>
      </Svg>

      {/* BDome in pixels, carved into the dirt as background: dark blocks over a lit lip */}
      <View style={styles.dome} pointerEvents="none">
        <PixelBDome width={DOME_W} cell={DOME_CELL} color={C.carve} opacity={0.85} lip={C.carveLip} lipOpacity={0.35} />
      </View>

      {/* Item frame in front of the dome: wood with plank lines, then the photo backing */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} fill={C.outline} />
        <Rect x={FRAME.x + 2} y={FRAME.y + 2} width={FRAME.size - 4} height={FRAME.size - 4} fill={C.wood} />
        <G fill={C.woodDark}>
          {[0.25, 0.5, 0.75].map((f) => (
            <G key={f}>
              <Rect x={FRAME.x + FRAME.size * f} y={FRAME.y + 2} width={2} height={FRAME.wood - 2} />
              <Rect x={FRAME.x + FRAME.size * f} y={FRAME.y + FRAME.size - FRAME.wood} width={2} height={FRAME.wood - 2} />
              <Rect x={FRAME.x + 2} y={FRAME.y + FRAME.size * f} width={FRAME.wood - 2} height={2} />
              <Rect x={FRAME.x + FRAME.size - FRAME.wood} y={FRAME.y + FRAME.size * f} width={FRAME.wood - 2} height={2} />
            </G>
          ))}
        </G>
        <Rect x={FRAME.x + 2} y={FRAME.y + 2} width={FRAME.size - 4} height={2} fill={C.woodLight} />
        <Rect
          x={FRAME.x + FRAME.wood - 2}
          y={FRAME.y + FRAME.wood - 2}
          width={FRAME.size - (FRAME.wood - 2) * 2}
          height={FRAME.size - (FRAME.wood - 2) * 2}
          fill={C.outline}
        />
      </Svg>

      {/* Photo in the frame */}
      <View style={styles.photo}>
        {props.avatarUrl ? (
          <Image source={{ uri: props.avatarUrl }} style={styles.photoImg} />
        ) : (
          <Text style={[styles.initials, shadow]}>{initials || '?'}</Text>
        )}
      </View>

      {/* Rating as an XP level, straight on the grass, top left */}
      <View style={styles.ratingBox}>
        {/* Sized by digit count so 4 digits still clear the frame (autoshrink can't keep the
            outline copies in step) */}
        <Outlined style={{ ...styles.rating, fontSize: RATING_SIZE[Math.min(String(props.rating).length, 4)] }}>
          {String(props.rating)}
        </Outlined>
        <Text style={[styles.ratingLabel, shadow]}>RATING</Text>
      </View>

      {/* Logo, straight on the grass, top right */}
      <View style={styles.logo}>
        <CardLogo id={props.logo} height={44} />
      </View>

      {/* Identity */}
      <Text style={[styles.name, shadow]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {props.fullName}
      </Text>
      <Text style={styles.subline} numberOfLines={1}>
        <Text style={[styles.handle, shadow]}>@{props.username}</Text>
        <Text style={[styles.tier, shadow, { color: ore.face }]}>{`  ${props.tier.toUpperCase()}`}</Text>
      </Text>

      {/* Hotbar */}
      <View style={styles.hotbar}>
        <Slot value={props.events} label="EVT" />
        <Slot value={props.podiums} label="POD" />
        <Slot value={props.challenges} label="CHL" />
        <Slot value={props.points ?? 0} label="PTS" />
      </View>

      {/* Mains */}
      {mains.length > 0 && (
        <Text style={[styles.mains, shadow]} numberOfLines={1}>
          {mains.join(' · ')}
        </Text>
      )}
    </View>
  );
}

/** Text with a hard black outline, like the game's XP level: four black copies under it. */
function Outlined({ children, style }: { children: string; style: TextStyle }) {
  return (
    <View>
      {[
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ].map(([x, y]) => (
        <Text key={`${x}${y}`} style={[style, styles.outline, { left: x, top: y }]} numberOfLines={1}>
          {children}
        </Text>
      ))}
      <Text style={style} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** Inventory slot: grey face, dark top-left edge, light bottom-right edge. */
function Bevel({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={w} height={h} fill={C.slot} />
      <Rect x={0} y={0} width={w} height={3} fill={C.slotDark} />
      <Rect x={0} y={0} width={3} height={h} fill={C.slotDark} />
      <Rect x={0} y={h - 3} width={w} height={3} fill={C.slotLight} />
      <Rect x={w - 3} y={0} width={3} height={h} fill={C.slotLight} />
    </Svg>
  );
}

function Slot({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.slot}>
      <Bevel w={58} h={58} />
      <Text style={[styles.slotValue, shadow]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {value.toLocaleString('en-IN')}
      </Text>
      <Text style={[styles.slotLabel, shadow]}>{label}</Text>
    </View>
  );
}

/** The game's hard drop shadow under every bit of text. */
const shadow: TextStyle = {
  textShadowColor: C.shadow,
  textShadowOffset: { width: 2, height: 2 },
  textShadowRadius: 1,
};

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
  },
  dome: {
    position: 'absolute',
    top: DOME_TOP,
    left: (W - DOME_W) / 2,
  },
  photo: {
    position: 'absolute',
    top: FRAME.y + FRAME.wood,
    left: FRAME.x + FRAME.wood,
    width: FRAME.size - FRAME.wood * 2,
    height: FRAME.size - FRAME.wood * 2,
    backgroundColor: C.photoBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: PIXEL_BOLD,
    fontSize: 52,
    color: C.text,
  },
  ratingBox: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 66,
    alignItems: 'center',
  },
  rating: {
    fontFamily: PIXEL_BOLD,
    fontSize: 34,
    lineHeight: 40,
    color: C.xp,
  },
  outline: {
    position: 'absolute',
    color: '#000000',
  },
  ratingLabel: {
    marginTop: -2,
    fontFamily: PIXEL_BOLD,
    fontSize: 11,
    lineHeight: 13,
    color: C.text,
  },
  logo: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  name: {
    position: 'absolute',
    top: STRIP_TOP + 8,
    left: 18,
    right: 18,
    textAlign: 'center',
    fontFamily: PIXEL_BOLD,
    fontSize: 28,
    lineHeight: 32,
    color: C.text,
  },
  subline: {
    position: 'absolute',
    top: STRIP_TOP + 42,
    left: 18,
    right: 18,
    textAlign: 'center',
  },
  handle: {
    fontFamily: PIXEL,
    fontSize: 14,
    color: C.textMuted,
  },
  tier: {
    fontFamily: PIXEL_BOLD,
    fontSize: 14,
  },
  hotbar: {
    position: 'absolute',
    top: STRIP_TOP + 82,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  slot: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotValue: {
    fontFamily: PIXEL_BOLD,
    fontSize: 22,
    lineHeight: 24,
    color: C.text,
    maxWidth: 50,
  },
  slotLabel: {
    fontFamily: PIXEL,
    fontSize: 10,
    lineHeight: 12,
    color: C.textMuted,
    marginTop: 1,
  },
  mains: {
    position: 'absolute',
    bottom: 18,
    left: 22,
    right: 22,
    textAlign: 'center',
    fontFamily: PIXEL,
    fontSize: 13,
    color: C.text,
  },
});

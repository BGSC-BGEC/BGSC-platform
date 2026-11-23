import React, { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type DerivedValue,
} from 'react-native-reanimated';
import { useClock } from '@shopify/react-native-skia';

import { GrainyGradient } from './reacticx/organisms/grainy-gradient';
import type { GrainyGradientColors } from './reacticx/organisms/grainy-gradient/types';
import { Doodle, type DoodleName } from './doodles/Doodles';
import { useTheme } from '../theme/ThemeProvider';
import { PALETTE, withAlpha } from '../theme/colors';

export interface GamingBackdropProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
  /** Height of the status bar + top bar; doodles there are drawn fainter. */
  topInset?: number;
  /** Height taken by the hero text + overlapping sheet; doodles there are drawn fainter. */
  bottomInset?: number;
  /** Stop all animation, e.g. while the screen is not focused. */
  paused?: boolean;
  /** Height of the fade into the screen background at the bottom (default: up to 150px). */
  fadeHeight?: number;
  /** Areas (px, in backdrop coordinates) kept free of doodles, e.g. behind an illustration. */
  clearRects?: ClearRect[];
}

export interface ClearRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlacedDoodle {
  name: DoodleName;
  /** Centre, in px. */
  cx: number;
  cy: number;
  size: number;
  rotate: number;
  /** Small marks (stars, crosses, rings, bolts, arrows). */
  filler: boolean;
  /** Behind the hero text or the top bar buttons: drawn fainter. */
  muted: boolean;
}

const MAIN_DOODLES: DoodleName[] = [
  'controller', 'helmet', 'headphones', 'foamFinger', 'monitor', 'hotDog', 'cup',
  'football', 'gamingChair', 'clipboard', 'vrHeadset', 'goalPost', 'keyboard', 'cap',
  'steeringWheel', 'energyDrink', 'shootingStar', 'joystick', 'trophy', 'jersey',
  'microphone', 'laptop', 'pcTower', 'whistle', 'megaphone', 'pennant', 'sneaker',
  'handheld', 'mouse',
];
const FILLER_DOODLES: DoodleName[] = ['star', 'cross', 'ring', 'bolt', 'arrow'];

/** Main doodle size range (px), gap kept between neighbours, and filler cap. */
const MAIN_SIZE: [number, number] = [42, 54];
const MAIN_GAP = 8;
const FILLER_SIZE: [number, number] = [9, 15];
const FILLER_GAP = 5;
const MAX_FILLERS = 24;
const LAYOUT_SEED = 20261121;

/** Small deterministic PRNG so the scatter is identical on every launch. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatters doodles over the whole area with "dart throwing": random candidates
 * are accepted only if they keep a minimum gap from everything already placed,
 * which spreads them evenly without rows or clumps. Fillers go in the gaps after.
 */
function scatterDoodles(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
  clearRects: ClearRect[] = [],
): PlacedDoodle[] {
  const rand = mulberry32(LAYOUT_SEED);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const placed: PlacedDoodle[] = [];

  // A doodle may not overlap a clear rect (its half-size counts as part of it).
  const inClearRect = (cx: number, cy: number, size: number) =>
    clearRects.some(
      (r) =>
        cx + size / 2 > r.x &&
        cx - size / 2 < r.x + r.width &&
        cy + size / 2 > r.y &&
        cy - size / 2 < r.y + r.height,
    );

  const fits = (cx: number, cy: number, size: number, gap: number) =>
    !inClearRect(cx, cy, size) &&
    placed.every((p) => Math.hypot(p.cx - cx, p.cy - cy) >= (p.size + size) / 2 + gap);

  // Fainter where it would sit behind the top bar buttons/wordmark or the hero text.
  const isMuted = (cx: number, cy: number) =>
    cy < topInset || (bottomInset > 0 && cy > height - bottomInset && cx < width * 0.8);

  const names = [...MAIN_DOODLES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }

  // Main doodles; centres may sit slightly past the edges so the sheet "runs off".
  let next = 0;
  for (let attempt = 0; attempt < 900; attempt++) {
    const size = between(MAIN_SIZE[0], MAIN_SIZE[1]);
    const cx = between(-size * 0.2, width + size * 0.2);
    const cy = between(size * 0.3, height - size * 0.3);
    if (!fits(cx, cy, size, MAIN_GAP)) continue;
    placed.push({
      name: names[next++ % names.length],
      cx,
      cy,
      size,
      rotate: between(-22, 22),
      filler: false,
      muted: isMuted(cx, cy),
    });
  }

  // Small marks in the leftover gaps.
  let fillers = 0;
  for (let attempt = 0; attempt < 900 && fillers < MAX_FILLERS; attempt++) {
    const size = between(FILLER_SIZE[0], FILLER_SIZE[1]);
    const cx = between(size, width - size);
    const cy = between(size, height - size);
    if (!fits(cx, cy, size, FILLER_GAP)) continue;
    placed.push({
      name: FILLER_DOODLES[Math.floor(rand() * FILLER_DOODLES.length)],
      cx,
      cy,
      size,
      rotate: between(-30, 30),
      filler: true,
      muted: isMuted(cx, cy),
    });
    fillers++;
  }

  return placed;
}

/** Blends two 6-digit hex colours: t = 0 gives `from`, t = 1 gives `to`. */
function mixHex(from: string, to: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.replace('#', '').substring(i, i + 2), 16);
  const out = [0, 2, 4].map((i) =>
    Math.round(ch(from, i) + (ch(to, i) - ch(from, i)) * t).toString(16).padStart(2, '0'),
  );
  return `#${out.join('')}`.toUpperCase();
}

/**
 * Near-flat grainy orange: close shades of the app's main orange (`PALETTE.orange`, the
 * button colour) so the hero matches the buttons and reads as one surface with soft tonal
 * shifts. Derived from the theme, so changing the brand orange updates the shader too.
 * Dark mode leans toward the deeper press shade; light mode toward a lighter tint.
 */
const DARK_GRADIENT: GrainyGradientColors = [
  PALETTE.orange,
  PALETTE.orangeDark,
  mixHex(PALETTE.orange, '#FFFFFF', 0.08),
  mixHex(PALETTE.orange, PALETTE.orangeDark, 0.5),
];
const LIGHT_GRADIENT: GrainyGradientColors = [
  mixHex(PALETTE.orange, '#FFFFFF', 0.1),
  PALETTE.orange,
  mixHex(PALETTE.orange, '#FFFFFF', 0.2),
  mixHex(PALETTE.orange, PALETTE.orangeDark, 0.25),
];

/**
 * Hero backdrop: slow grainy gradient, a few floating doodles, and a fade into the
 * screen background at the bottom.
 */
export function GamingBackdrop({
  width: widthProp,
  height = 280,
  style,
  topInset = 0,
  bottomInset = 0,
  paused = false,
  fadeHeight,
  clearRects,
}: GamingBackdropProps) {
  const { colors, isDark } = useTheme();
  const window = useWindowDimensions();
  const width = typeof widthProp === 'number' ? widthProp : window.width;

  const appActive = useAppActive();
  const running = !paused && appActive;

  // One shared clock (seconds) drives every doodle's float. Built on Skia's always-running
  // clock rather than a toggled useFrameCallback, which could stall on Android until the
  // screen was touched. Pausing just stops time from accumulating.
  const skiaClock = useClock();
  const lastTick = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const clock = useDerivedValue(() => {
    const now = skiaClock.value;
    const dt = lastTick.value === 0 ? 0 : now - lastTick.value;
    lastTick.value = now;
    if (running) elapsed.value += dt / 1000;
    return elapsed.value;
  });

  const placed = useMemo(
    () => scatterDoodles(width, height, topInset, bottomInset, clearRects),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, topInset, bottomInset, JSON.stringify(clearRects ?? [])],
  );

  // White line art on orange, like a doodle sheet; small marks a little stronger.
  // Doodles behind text or the top bar buttons are fainter so they don't hurt legibility.
  const colorFor = (d: PlacedDoodle) =>
    withAlpha('#FFFFFF', d.muted ? (d.filler ? 0.18 : 0.14) : d.filler ? 0.3 : 0.24);

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <GrainyGradient
        width={width}
        height={height}
        colors={isDark ? DARK_GRADIENT : LIGHT_GRADIENT}
        brightness={isDark ? -0.08 : -0.04}
        speed={0.5}
        amplitude={0.08}
        intensity={0.11}
        size={1.4}
        animated={running}
      />

      {placed.map((d, i) => (
        <FloatingDoodle
          key={`${d.name}-${i}`}
          doodle={d}
          left={d.cx - d.size / 2}
          top={d.cy - d.size / 2}
          phase={i * 1.7}
          clock={clock}
          color={colorFor(d)}
        />
      ))}

      {/* Fade into the screen background; also keeps the hero text readable. */}
      <LinearGradient
        colors={['transparent', withAlpha(colors.background, 0.7), colors.background]}
        locations={[0, 0.6, 1]}
        style={[styles.bottomFade, { height: fadeHeight ?? Math.min(height * 0.5, 150) }]}
      />
    </View>
  );
}

function FloatingDoodle({
  doodle,
  left,
  top,
  phase,
  clock,
  color,
}: {
  doodle: PlacedDoodle;
  left: number;
  top: number;
  phase: number;
  clock: DerivedValue<number>;
  color: string;
}) {
  const floatStyle = useAnimatedStyle(() => {
    const t = clock.value * 0.6 + phase;
    return {
      transform: [
        { translateY: Math.sin(t) * 3 },
        { rotate: `${doodle.rotate + Math.sin(t * 0.7) * 4}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.doodle, { left, top }, floatStyle]}>
      <Doodle name={doodle.name} size={doodle.size} color={color} />
    </Animated.View>
  );
}

function useAppActive(): boolean {
  // Treat an unknown/null launch state as active: only pause when we know we're backgrounded.
  // (A missed initial 'active' event would otherwise leave the backdrop paused.)
  const [active, setActive] = useState(
    () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  doodle: {
    position: 'absolute',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});

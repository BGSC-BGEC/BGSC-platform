import React from 'react';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * The BDome (BITS Pilani, Goa campus) in the style of the home page illustration
 * (`assets/images/hero-clubhouse.png`): warm sandstone walls with dark outlines, a broad dome on a
 * drum ringed with small windows, an upper storey, the main block with its stepped central portal
 * and window-lined wings, a wide front platform, palms behind and maroon shrubs at the sides.
 *
 * Drawn on a 260×150 grid. Colours are the building's own (same on every card tier).
 */
export const BDOME_ASPECT = 260 / 150;

const C = {
  outline: '#3A2216',
  wall: '#EDC98F',
  wallShade: '#D9A865',
  dome: '#E8B57C',
  domeShade: '#CF9358',
  window: '#5A2620',
  base: '#E59C6C',
  baseShade: '#C97E52',
  palm: '#6E9A3E',
  palmDark: '#4B7228',
  trunk: '#8A5A32',
  shrub: '#8C2B2E',
  shrubDark: '#6A1D22',
};

export function BDomeArt({ width = 260 }: { width?: number }) {
  const height = width / BDOME_ASPECT;
  const o = { stroke: C.outline, strokeWidth: 1.1, strokeLinejoin: 'round' as const };

  const wingWindowsX = [42, 54, 66, 78, 172, 184, 196, 208];
  const upperWindowsX = Array.from({ length: 13 }, (_, i) => 63 + i * 11);
  const drumWindowsX = Array.from({ length: 11 }, (_, i) => 84 + i * 9);

  return (
    <Svg width={width} height={height} viewBox="0 0 260 150">
      {/* Behind: palms and shrubs, mirrored */}
      <Greenery />
      <G transform="translate(260,0) scale(-1,1)">
        <Greenery />
      </G>

      {/* Dome, finial and drum */}
      <Path d="M80 45 C80 10 180 10 180 45 Z" fill={C.dome} {...o} />
      <Path d="M130 19 C160 20 178 30 180 45 L163 45 C161 33 150 23 130 19 Z" fill={C.domeShade} />
      {/* Panel seams, like the home illustration's dome */}
      <Path
        d="M130 19 V45 M112 22 C104 30 101 38 101 45 M148 22 C156 30 159 38 159 45 M96 30 C91 36 89 41 89 45 M164 30 C169 36 171 41 171 45"
        fill="none"
        stroke={C.outline}
        strokeWidth={0.7}
        opacity={0.55}
      />
      <Path d="M80 45 C80 10 180 10 180 45" fill="none" {...o} />
      <Ellipse cx={130} cy={18} rx={10} ry={3} fill={C.domeShade} {...o} />
      <Rect x={127} y={10} width={6} height={6} rx={1} fill={C.wallShade} {...o} />
      <Rect x={78} y={45} width={104} height={10} fill={C.domeShade} {...o} />
      {drumWindowsX.map((x) => (
        <Rect key={`d${x}`} x={x} y={47.5} width={4} height={5.5} rx={0.8} fill={C.window} />
      ))}

      {/* Upper storey with its cornice */}
      <Rect x={52} y={55} width={156} height={4} fill={C.wallShade} {...o} />
      <Rect x={56} y={59} width={148} height={21} fill={C.wall} {...o} />
      {upperWindowsX.map((x) => (
        <Rect key={`u${x}`} x={x} y={63.5} width={6} height={11} rx={1} fill={C.window} />
      ))}
      <Rect x={26} y={80} width={208} height={5} fill={C.wallShade} {...o} />

      {/* Main block: wings with pilasters and two rows of windows */}
      <Rect x={30} y={85} width={200} height={39} fill={C.wall} {...o} />
      {[30, 88, 167, 224].map((x) => (
        <Rect key={`p${x}`} x={x} y={85} width={6} height={39} fill={C.wallShade} {...o} />
      ))}
      {wingWindowsX.map((x) => (
        <G key={`w${x}`}>
          <Rect x={x} y={90} width={7} height={9} rx={1} fill={C.window} />
          <Rect x={x} y={106} width={7} height={9} rx={1} fill={C.window} />
        </G>
      ))}

      {/* Stepped central portal and doorway */}
      <Rect x={97} y={82} width={66} height={42} fill={C.wallShade} {...o} />
      <Rect x={103} y={88} width={54} height={36} fill={C.wall} {...o} />
      <Rect x={109} y={94} width={42} height={30} fill={C.wallShade} {...o} />
      <Rect x={119} y={103} width={22} height={21} fill={C.window} {...o} />

      {/* Plinth, entrance steps and the wide front platform */}
      <Rect x={22} y={124} width={216} height={8} fill={C.wallShade} {...o} />
      <Path d="M4 150 L22 132 L238 132 L256 150 Z" fill={C.base} {...o} />
      <Path d="M22 132 L238 132 L242 136 L18 136 Z" fill={C.baseShade} />
      <Rect x={112} y={124} width={36} height={4} fill={C.base} {...o} />
      <Rect x={106} y={128} width={48} height={4} fill={C.base} {...o} />
    </Svg>
  );
}

/** Left side: a tall and a short palm behind the building, and a maroon shrub at its foot. */
function Greenery() {
  const o = { stroke: C.outline, strokeWidth: 1, strokeLinejoin: 'round' as const };
  return (
    <G>
      <Palm x={58} y={34} trunkBase={[52, 124]} size={1} o={o} />
      <Palm x={38} y={58} trunkBase={[36, 124]} size={0.78} o={o} />
      <Path
        d="M0 132 C-2 116 8 104 18 108 C20 96 34 96 36 106 C44 104 48 114 44 122 C48 128 42 134 34 132 Z"
        fill={C.shrub}
        {...o}
      />
      <Path d="M10 126 C14 118 20 114 26 116 M24 128 C28 120 34 116 40 118" fill="none" stroke={C.shrubDark} strokeWidth={1.2} />
    </G>
  );
}

function Palm({
  x,
  y,
  trunkBase,
  size,
  o,
}: {
  x: number;
  y: number;
  trunkBase: [number, number];
  size: number;
  o: Record<string, unknown>;
}) {
  const [bx, by] = trunkBase;
  // Almond-shaped frond from the crown (x, y) to a tip.
  const leaf = (dx: number, dy: number, w: number) => {
    const tx = x + dx * size;
    const ty = y + dy * size;
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    const len = Math.hypot(tx - x, ty - y) || 1;
    const nx = (-(ty - y) / len) * w * size;
    const ny = ((tx - x) / len) * w * size;
    return `M${x} ${y} Q${mx + nx} ${my + ny} ${tx} ${ty} Q${mx - nx} ${my - ny} ${x} ${y} Z`;
  };
  return (
    <G>
      <Path
        d={`M${bx - 2.5} ${by} C${bx - 1} ${(by + y) / 2} ${x - 4} ${y + 18} ${x - 2} ${y} L${x + 2} ${y} C${x} ${y + 18} ${bx + 3} ${(by + y) / 2} ${bx + 2.5} ${by} Z`}
        fill={C.trunk}
        {...o}
      />
      <Path d={leaf(-26, 8, 5)} fill={C.palmDark} {...o} />
      <Path d={leaf(24, 10, 5)} fill={C.palmDark} {...o} />
      <Path d={leaf(-22, -10, 5)} fill={C.palm} {...o} />
      <Path d={leaf(22, -12, 5)} fill={C.palm} {...o} />
      <Path d={leaf(-4, -22, 4.5)} fill={C.palm} {...o} />
    </G>
  );
}

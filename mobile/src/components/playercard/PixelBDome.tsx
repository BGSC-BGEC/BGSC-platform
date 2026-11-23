import React from 'react';
import Svg, { G, Rect } from 'react-native-svg';

/**
 * The BDome as pixel art: the line art's geometry (see BDomeLineArt; same drawing coordinates)
 * snapped to a grid of square cells. Outlines become runs of blocks and every window one solid
 * block. For blocky card styles; the others use the smooth line art.
 *
 * The grid is computed once per (width, cell) and cached.
 */

const VB = { x: 165, y: 325, w: 700, h: 345 };

type Pt = [number, number];

const range = (n: number, start: number, step: number) => Array.from({ length: n }, (_, i) => start + i * step);
const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt[] =>
  range(41, 0, 1 / 40).map((t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];
const vline = (x: number, y1: number, y2: number): Pt[] => [
  [x, y1],
  [x, y2],
];

/** Polylines tracing the building, from BDomeLineArt's paths. */
const LINES: Pt[][] = [
  // Dome, rib, finial
  cubic([400, 400], [400, 330], [640, 330], [640, 400]),
  cubic([458, 400], [462, 368], [490, 352], [520, 349]),
  cubic([496, 349], [496, 332], [544, 332], [544, 349]),
  // Drum, band, roof slab, upper storey, main slab, main block
  rect(388, 400, 259, 10),
  rect(398, 410, 239, 14),
  rect(280, 424, 476, 10),
  rect(292, 434, 452, 42),
  rect(247, 476, 538, 22),
  rect(266, 498, 500, 106),
  // Roof joints and upper pilasters
  ...[322, 424, 607, 714].map((x) => vline(x, 424, 434)),
  ...[333, 430, 607, 703].map((x) => vline(x, 434, 476)),
  // Stepped portal
  vline(440, 498, 604),
  vline(593, 498, 604),
  [[455, 604], [455, 513], [577, 513], [577, 604]],
  [[477, 604], [477, 535], [556, 535], [556, 604]],
  [[492, 604], [492, 551], [540, 551], [540, 604]],
  // Double-line pilasters in the main block
  ...[333, 420, 593, 678].flatMap((x) => [vline(x, 498, 604), vline(x + 19, 498, 604)]),
  // Ramps and base
  [[266, 583], [172, 636], [172, 662], [198, 662], [198, 636], [266, 598]],
  [[766, 583], [857, 636], [857, 662], [831, 662], [831, 636], [766, 598]],
  [[172, 662], [857, 662]],
];

/**
 * Windows as areas [x, y, w, h], each drawn as a small solid block of its size in cells, so a
 * window comes out as a block, not a stray dot. The drum's tiny windows are left out: at card
 * size they'd fuse into a solid bar.
 */
const WINDOWS: [number, number, number, number][] = [
  ...[305, 345, 372, 399, 440, 467, 494, 521, 548, 575, 618, 645, 672, 716].map(
    (x): [number, number, number, number] => [x, 448, 14, 18],
  ),
  ...[297, 320, 370, 393, 627, 650, 700, 722].map((x): [number, number, number, number] => [x, 505, 10, 25]),
  ...[274, 300, 357, 383, 625, 651, 708, 734].map((x): [number, number, number, number] => [x, 568, 9, 20]),
];

interface Run {
  x: number;
  y: number;
  w: number;
}

const cache = new Map<string, { runs: Run[]; cols: number; rows: number }>();

export function pixelate(width: number, cell: number) {
  const key = `${width}:${cell}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const scale = width / VB.w;
  const cols = Math.ceil((VB.w * scale) / cell);
  const rows = Math.ceil((VB.h * scale) / cell);
  const on = new Set<number>();
  const mark = ([x, y]: Pt) => {
    const c = Math.floor(((x - VB.x) * scale) / cell);
    const r = Math.floor(((y - VB.y) * scale) / cell);
    if (c >= 0 && c < cols && r >= 0 && r < rows) on.add(r * cols + c);
  };

  // Walk every segment in steps of a third of a cell, so no line skips a cell.
  const step = cell / scale / 3;
  for (const line of LINES) {
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1]!, line[i]!];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let k = 0; k <= n; k++) mark([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
  }
  // Every window of a kind gets the same block size (its size in cells, rounded, at least 1),
  // centred on the window: snapping each one's own edges made neighbours 1 and 2 blocks wide.
  const units = cell / scale; // one cell in drawing units
  for (const [x, y, w, h] of WINDOWS) {
    const wc = Math.max(1, Math.round(w / units));
    const hc = Math.max(1, Math.round(h / units));
    let c0 = Math.round(((x + w / 2 - VB.x) * scale) / cell - wc / 2);
    const r0 = Math.round(((y + h / 2 - VB.y) * scale) / cell - hc / 2);
    // A window touching a wall or pilaster fuses into it: nudge it a cell clear.
    const litCol = (c: number) => range(hc, r0, 1).some((r) => on.has(r * cols + c));
    if (litCol(c0 - 1) || litCol(c0)) c0 += 1;
    else if (litCol(c0 + wc) || litCol(c0 + wc - 1)) c0 -= 1;
    for (let r = r0; r < r0 + hc; r++) {
      for (let c = c0; c < c0 + wc; c++) mark([VB.x + (c + 0.5) * units, VB.y + (r + 0.5) * units]);
    }
  }

  // Merge each row's lit cells into runs.
  const runs: Run[] = [];
  for (let r = 0; r < rows; r++) {
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const lit = c < cols && on.has(r * cols + c);
      if (lit && start < 0) start = c;
      if (!lit && start >= 0) {
        runs.push({ x: start * cell, y: r * cell, w: (c - start) * cell });
        start = -1;
      }
    }
  }

  const result = { runs, cols, rows };
  cache.set(key, result);
  return result;
}

/**
 * Pixel BDome. `lip`, when given, draws the same blocks one cell lower in that colour first, so the
 * building reads as carved into the surface it sits on.
 */
export function PixelBDome({
  width,
  cell = 4,
  color,
  opacity = 1,
  lip,
  lipOpacity = 0.7,
}: {
  width: number;
  cell?: number;
  color: string;
  opacity?: number;
  lip?: string;
  lipOpacity?: number;
}) {
  const { runs, cols, rows } = pixelate(width, cell);
  const w = cols * cell;
  const h = (rows + 1) * cell; // room for the lip row

  return (
    <Svg width={w} height={h}>
      {lip && (
        <G fill={lip} opacity={lipOpacity}>
          {runs.map((r) => (
            <Rect key={`l${r.x}-${r.y}`} x={r.x} y={r.y + cell} width={r.w} height={cell} />
          ))}
        </G>
      )}
      <G fill={color} opacity={opacity}>
        {runs.map((r) => (
          <Rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={cell} />
        ))}
      </G>
    </Svg>
  );
}

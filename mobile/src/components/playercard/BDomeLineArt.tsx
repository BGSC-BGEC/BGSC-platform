import React from 'react';
import Svg, { G, Path, Rect } from 'react-native-svg';

/**
 * The BDome as line art: the backdrop every player card style shares. Traced from the campus line
 * drawing, strokes only, so each style picks its own ink and opacity.
 *
 * Drawn in the source drawing's coordinates; the viewBox crops to the building.
 */
export const BDOME_LINE_ASPECT = 700 / 345;
const VIEWBOX = '165 325 700 345';

const range = (n: number, start: number, step: number) => Array.from({ length: n }, (_, i) => start + i * step);

/** Small windows in the band under the dome. */
const DRUM_WINDOWS = range(22, 403, 10.6);
/** Upper storey windows, grouped between its pilasters. */
const UPPER_WINDOWS = [305, 345, 372, 399, 440, 467, 494, 521, 548, 575, 618, 645, 672, 716];
/** Wing windows: tall upper row, short lower row. */
const WING_UPPER = [297, 320, 370, 393, 627, 650, 700, 722];
const WING_LOWER = [274, 300, 357, 383, 625, 651, 708, 734];
/** Double-line pilasters across the main block. */
const PILASTERS = [333, 420, 593, 678];

export function BDomeLineArt({
  width,
  color,
  strokeWidth = 2.2,
  opacity = 1,
}: {
  width: number;
  color: string;
  /** In drawing units (the drawing is ~700 wide), so it scales with the art. */
  strokeWidth?: number;
  opacity?: number;
}) {
  const s = { fill: 'none', stroke: color, strokeWidth, strokeLinejoin: 'round' as const };
  const thin = { ...s, strokeWidth: strokeWidth * 0.7 };

  return (
    <Svg width={width} height={width / BDOME_LINE_ASPECT} viewBox={VIEWBOX} opacity={opacity}>
      <G {...s}>
        {/* Dome, inner rib and finial */}
        <Path d="M400 400 C400 330 640 330 640 400" />
        <Path d="M458 400 C462 368 490 352 520 349" />
        <Path d="M496 349 C496 332 544 332 544 349" />
        {/* Drum ledge and window band */}
        <Rect x={388} y={400} width={259} height={10} />
        <Rect x={398} y={410} width={239} height={14} />
        {/* Roof slab with its joints */}
        <Rect x={280} y={424} width={476} height={10} />
        <Path d="M322 424 V434 M424 424 V434 M607 424 V434 M714 424 V434" />
        {/* Upper storey and its pilasters */}
        <Rect x={292} y={434} width={452} height={42} />
        <Path d="M333 434 V476 M430 434 V476 M607 434 V476 M703 434 V476" />
        {/* Main slab and block */}
        <Rect x={247} y={476} width={538} height={22} />
        <Rect x={266} y={498} width={500} height={106} />
        {/* Stepped central portal */}
        <Path d="M440 604 V498 M593 498 V604" />
        <Path d="M455 604 V513 H577 V604" />
        <Path d="M477 604 V535 H556 V604" />
        <Path d="M492 604 V551 H540 V604" />
        {/* Platform: side ramps and base line */}
        <Path d="M266 583 L172 636 V662 H198 V636 L266 598" />
        <Path d="M766 583 L857 636 V662 H831 V636 L766 598" />
        <Path d="M172 662 H857" />
        <Path d="M198 636 H831" opacity={0.5} />
      </G>

      <G {...thin}>
        {DRUM_WINDOWS.map((x) => (
          <Rect key={`d${x}`} x={x} y={413} width={6} height={8} />
        ))}
        {UPPER_WINDOWS.map((x) => (
          <Rect key={`u${x}`} x={x} y={448} width={14} height={18} />
        ))}
        {WING_UPPER.map((x) => (
          <Rect key={`w${x}`} x={x} y={505} width={10} height={25} />
        ))}
        {WING_LOWER.map((x) => (
          <Rect key={`l${x}`} x={x} y={568} width={9} height={20} />
        ))}
        {PILASTERS.map((x) => (
          <G key={`p${x}`}>
            <Path d={`M${x} 498 V604 M${x + 19} 498 V604`} />
            <Path d={`M${x} 520 H${x + 19} M${x} 545 H${x + 19} M${x} 570 H${x + 19} M${x} 590 H${x + 19}`} />
          </G>
        ))}
        {/* The inset lines in each wing */}
        <Path d="M290 498 V545 H333 M742 498 V545 H697" />
      </G>
    </Svg>
  );
}

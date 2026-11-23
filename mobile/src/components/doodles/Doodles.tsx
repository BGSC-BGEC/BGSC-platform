import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

/**
 * Hand-drawn style line doodles (sports + gaming) for decorative backgrounds.
 * Original artwork: bold rounded outlines on a 48×48 grid, no fills, so they sit
 * lightly on any background. Colour and stroke weight come from props.
 */
export type DoodleName =
  // gaming
  | 'controller'
  | 'headphones'
  | 'joystick'
  | 'handheld'
  | 'mouse'
  | 'gamingChair'
  | 'monitor'
  | 'keyboard'
  | 'pcTower'
  | 'vrHeadset'
  | 'laptop'
  | 'microphone'
  | 'steeringWheel'
  | 'energyDrink'
  // sports
  | 'helmet'
  | 'foamFinger'
  | 'clipboard'
  | 'goalPost'
  | 'hotDog'
  | 'cup'
  | 'cap'
  | 'shootingStar'
  | 'football'
  | 'jersey'
  | 'trophy'
  | 'whistle'
  | 'megaphone'
  | 'pennant'
  | 'sneaker'
  // fillers
  | 'star'
  | 'cross'
  | 'ring'
  | 'bolt'
  | 'arrow';

interface ArtProps {
  color: string;
}

const ART: Record<DoodleName, (p: ArtProps) => React.ReactElement> = {
  controller: ({ color }) => (
    <G>
      <Path d="M15 15h18c5 0 8 3 9 8l2 9c1 5-4 8-8 4l-4-4H16l-4 4c-4 4-9 1-8-4l2-9c1-5 4-8 9-8z" />
      <Path d="M14 21v7M10.5 24.5h7" />
      <Circle cx={33} cy={22} r={1.6} fill={color} />
      <Circle cx={37} cy={25.5} r={1.6} fill={color} />
      <Path d="M21.5 21h1.5M25 21h1.5" />
    </G>
  ),
  headphones: () => (
    <G>
      <Path d="M9 30v-6a15 15 0 0 1 30 0v6" />
      <Rect x={5} y={27} width={9} height={13} rx={3.5} />
      <Rect x={34} y={27} width={9} height={13} rx={3.5} />
    </G>
  ),
  joystick: ({ color }) => (
    <G>
      <Path d="M8 37c0-3 7-5 16-5s16 2 16 5-7 5-16 5-16-2-16-5z" />
      <Path d="M24 33V19" />
      <Circle cx={24} cy={13} r={6} />
      <Circle cx={33.5} cy={36.5} r={1.6} fill={color} />
    </G>
  ),
  handheld: ({ color }) => (
    <G>
      <Rect x={4} y={13} width={40} height={23} rx={7} />
      <Rect x={15} y={17} width={18} height={15} rx={2} />
      <Path d="M9 24.5h5M11.5 22v5" />
      <Circle cx={37.5} cy={22.5} r={1.4} fill={color} />
      <Circle cx={35.5} cy={27.5} r={1.4} fill={color} />
    </G>
  ),
  mouse: () => (
    <G>
      <Rect x={14} y={5} width={20} height={36} rx={10} />
      <Path d="M24 5v12M14 17h20" />
      <Path d="M24 41c0 3 2 4 5 4" />
    </G>
  ),
  gamingChair: ({ color }) => (
    <G>
      <Path d="M15 3h18c2 0 3 2 3 4l-2 19H14L12 7c0-2 1-4 3-4z" />
      <Path d="M19 8l1 14M29 8l-1 14" />
      <Rect x={10} y={26} width={28} height={5} rx={2} />
      <Path d="M8 19v9M40 19v9" />
      <Path d="M24 31v7M13 42l11-4 11 4" />
      <Circle cx={13} cy={43.5} r={1.4} fill={color} />
      <Circle cx={35} cy={43.5} r={1.4} fill={color} />
      <Circle cx={24} cy={44} r={1.4} fill={color} />
    </G>
  ),
  monitor: () => (
    <G>
      <Rect x={4} y={7} width={40} height={27} rx={3} />
      <Rect x={8} y={11} width={32} height={19} rx={1} />
      <Path d="M24 34v6M15 42h18" />
    </G>
  ),
  keyboard: () => (
    <G>
      <Rect x={3} y={14} width={42} height={21} rx={3} />
      <Path d="M8 20h2M13 20h2M18 20h2M23 20h2M28 20h2M33 20h2M38 20h2" />
      <Path d="M10 25h2M15 25h2M20 25h2M25 25h2M30 25h2M35 25h2" />
      <Path d="M14 30h20" />
    </G>
  ),
  pcTower: () => (
    <G>
      <Rect x={13} y={4} width={22} height={40} rx={2} />
      <Circle cx={24} cy={11} r={2.6} />
      <Path d="M17 18h14M17 22h14" />
      <Path d="M18 33h12M18 37h12" />
    </G>
  ),
  vrHeadset: () => (
    <G>
      <Path d="M6 18c0-4 3-6 7-6h22c4 0 7 2 7 6v10c0 4-3 6-7 6h-6l-3-4h-4l-3 4h-6c-4 0-7-2-7-6z" />
      <Path d="M6 21H2M42 21h4" />
      <Path d="M12 18h6M30 18h6" />
    </G>
  ),
  laptop: () => (
    <G>
      <Rect x={9} y={8} width={30} height={22} rx={2} />
      <Rect x={12.5} y={11.5} width={23} height={15} rx={1} />
      <Path d="M4 34h40l-3 5H7z" />
    </G>
  ),
  microphone: () => (
    <G>
      <Rect x={18} y={3} width={12} height={21} rx={6} />
      <Path d="M18 11h12M18 15h12" />
      <Path d="M12 18c0 8 5 12 12 12s12-4 12-12" />
      <Path d="M24 30v10M16 43h16" />
    </G>
  ),
  steeringWheel: () => (
    <G>
      <Circle cx={24} cy={21} r={16} />
      <Circle cx={24} cy={21} r={5} />
      <Path d="M8 21h11M29 21h11M24 26v11" />
      <Path d="M18 42h12" />
    </G>
  ),
  energyDrink: () => (
    <G>
      <Path d="M19 4h10v6h-10z" />
      <Path d="M19 10c-4 2-6 6-6 10v21c0 2 1 3 3 3h16c2 0 3-1 3-3V20c0-4-2-8-6-10" />
      <Path d="M26 22l-6 9h5l-2 7 7-10h-5z" />
    </G>
  ),
  helmet: () => (
    <G>
      <Path d="M8 30C8 16 17 7 28 7c8 0 14 6 14 15v4l-12 2-2 9-14 1c-4 0-6-3-6-8z" />
      <Path d="M20 8c6 3 10 9 10 18" />
      <Circle cx={21} cy={27} r={3} />
      <Path d="M30 28h14M34 24v14M40 28v9M30 34h14" />
    </G>
  ),
  foamFinger: ({ color }) => (
    <G>
      <Path d="M20 23V8c0-4 7-4 7 0v15" />
      <Path d="M14 44V28c0-3 2-5 5-5h14c3 0 5 2 5 5v16z" />
      <Path d="M14 30c-4 0-5-5-2-7" />
      <SvgText
        x={26}
        y={38}
        fill={color}
        stroke="none"
        fontSize={9}
        fontWeight="bold"
        textAnchor="middle"
      >
        #1
      </SvgText>
    </G>
  ),
  clipboard: () => (
    <G>
      <Rect x={10} y={8} width={28} height={36} rx={3} />
      <Rect x={18} y={4.5} width={12} height={6} rx={2} />
      <Path d="M15 17l4 4M19 17l-4 4" />
      <Circle cx={31} cy={19} r={2.5} />
      <Path d="M16 34c4-6 9 0 14-5" />
      <Path d="M27 27.5l3 1.5-1 3" />
      <Path d="M27 36l3 3M30 36l-3 3" />
    </G>
  ),
  goalPost: () => (
    <G>
      <Path d="M9 5v19h30V5" />
      <Path d="M24 24v20" />
      <Path d="M26 15c0-3 3-6 7-6 1 0 1 0 1 1 0 3-3 6-7 6-1 0-1 0-1-1z" />
      <Path d="M19 18l-4 2M20 22l-4 2" />
    </G>
  ),
  hotDog: () => (
    <G>
      <Path d="M4 24c0-5 40-5 40 0 0 3-40 3-40 0z" />
      <Path d="M6 27c1 7 9 11 18 11s17-4 18-11" />
      <Path d="M10 21.5l3-2 3 2 3-2 3 2 3-2 3 2 3-2 3 2 3-2 2 1.5" />
    </G>
  ),
  cup: () => (
    <G>
      <Path d="M11 10h26v5H11z" />
      <Path d="M13 15h22l-3 29H16z" />
      <Path d="M27 10l3-7h6" />
      <Path d="M14.5 26h19M15.5 34h17" />
    </G>
  ),
  cap: ({ color }) => (
    <G>
      <Path d="M8 30C8 18 15 10 24 10s16 8 16 20z" />
      <Path d="M40 30c5 0 7 3 4 6H22" />
      <Path d="M24 10c-4 6-5 13-4 20" />
      <Circle cx={24} cy={9} r={1.4} fill={color} />
    </G>
  ),
  shootingStar: () => (
    <G>
      <Path d="M34 4l2.8 6.4 7 .6-5.3 4.6 1.6 6.9L34 19l-6.1 3.5 1.6-6.9-5.3-4.6 7-.6z" />
      <Path d="M6 44c6-12 13-20 20-24M11 45c5-9 11-15 17-19" />
    </G>
  ),
  football: () => (
    <G>
      <Path d="M8 34C8 20 20 8 34 8c6 0 6 0 6 6 0 14-12 26-26 26-6 0-6 0-6-6z" />
      <Path d="M18 30l12-12" />
      <Path d="M20 24.5l3.5 3.5M23 21.5l3.5 3.5M26 18.5l3.5 3.5" />
      <Path d="M11.5 31.5l5 5M31.5 11.5l5 5" />
    </G>
  ),
  jersey: () => (
    <G>
      <Path d="M17 6l-9 4-4 10 6 3v19h28V23l6-3-4-10-9-4c-1 4-4 6-7 6s-6-2-7-6z" />
      <Path d="M20.5 21h7l-4.5 11" />
    </G>
  ),
  trophy: () => (
    <G>
      <Path d="M15 7h18v9a9 9 0 0 1-18 0z" />
      <Path d="M15 10h-3a4 4 0 0 0 3 9M33 10h3a4 4 0 0 1-3 9" />
      <Path d="M24 25v7M19 32h10" />
      <Rect x={16} y={36} width={16} height={5} rx={1.5} />
    </G>
  ),
  whistle: () => (
    <G>
      <Circle cx={27} cy={29} r={10} />
      <Path d="M5 18h19v7" />
      <Path d="M5 18v6h12" />
      <Circle cx={39} cy={12} r={4} />
      <Path d="M35.5 14.5l-3 3" />
    </G>
  ),
  megaphone: () => (
    <G>
      <Path d="M7 21v8h5l22 9V12L12 21z" />
      <Path d="M13 29.5l2 8h5l-2-7" />
      <Path d="M39 20a6 6 0 0 1 0 10" />
    </G>
  ),
  pennant: ({ color }) => (
    <G>
      <Path d="M9 6v38" />
      <Path d="M9 12l34 9-34 9z" />
      <SvgText
        x={20}
        y={23.5}
        fill={color}
        stroke="none"
        fontSize={7}
        fontWeight="bold"
        textAnchor="middle"
      >
        GO
      </SvgText>
    </G>
  ),
  sneaker: () => (
    <G>
      <Path d="M5 34v-9l8-2 6 6c6 2 14 2 20 4a4 4 0 0 1 3 4v2H5z" />
      <Path d="M5 38h37" />
      <Path d="M15.5 25.5l3-2M18.5 28.5l3-2" />
    </G>
  ),
  star: () => <Path d="M24 7l4.6 10.6 11.4 1-8.6 7.6 2.6 11.3L24 31.6l-10 5.9 2.6-11.3L8 18.6l11.4-1z" />,
  cross: () => <Path d="M13 13l22 22M35 13L13 35" />,
  ring: () => <Circle cx={24} cy={24} r={13} />,
  bolt: () => <Path d="M27 4L11 27h11l-3 17 18-25H25z" />,
  arrow: () => (
    <G>
      <Path d="M7 36c8-14 20-22 34-23" />
      <Path d="M33 8l8 5-6 7" />
    </G>
  ),
};

export interface DoodleProps {
  name: DoodleName;
  size: number;
  color: string;
  /** Stroke weight in grid units (the grid is 48 wide). */
  strokeWidth?: number;
}

export function Doodle({ name, size, color, strokeWidth = 2.4 }: DoodleProps) {
  const Art = ART[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Art color={color} />
    </Svg>
  );
}

import { useWindowDimensions } from 'react-native';
import {
  BREAKPOINTS,
  type Breakpoint,
  type DeviceType,
  type Orientation,
  type PhoneSize,
} from './breakpoints';
import { clamp, moderateScale as calcModerateScale, scale as calcScale } from './scaling';

export interface ResponsiveInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  orientation: Orientation;
  deviceType: DeviceType;
  phoneSize: PhoneSize;
  isPhone: boolean;
  isCompactPhone: boolean;
  isStandardPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  gutter: number;
  cardPadding: number;
  contentMaxWidth: number;
  contentWidth: number;
  scale: (size: number) => number;
  moderateScale: (size: number, factor?: number) => number;
  gridColumns: (minTileWidth: number, gap?: number) => { columns: number; tileWidth: number };
}

/**
 * Hook providing dynamic screen dimensions, breakpoint matching, phone-size tiers, and layout tokens.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const orientation: Orientation = width > height ? 'landscape' : 'portrait';

  let breakpoint: Breakpoint = 'xs';
  if (width >= BREAKPOINTS.xl) {
    breakpoint = 'xl';
  } else if (width >= BREAKPOINTS.lg) {
    breakpoint = 'lg';
  } else if (width >= BREAKPOINTS.md) {
    breakpoint = 'md';
  } else if (width >= BREAKPOINTS.lgPhone) {
    breakpoint = 'lgPhone';
  } else if (width >= BREAKPOINTS.sm) {
    breakpoint = 'sm';
  }

  let deviceType: DeviceType = 'phone';
  if (width >= BREAKPOINTS.lg) {
    deviceType = 'desktop';
  } else if (width >= BREAKPOINTS.md) {
    deviceType = 'tablet';
  }

  const isCompactPhone = width < BREAKPOINTS.sm;
  const isStandardPhone = width >= BREAKPOINTS.sm && width < BREAKPOINTS.lgPhone;
  const isLargePhone = width >= BREAKPOINTS.lgPhone && width < BREAKPOINTS.md;
  const phoneSize: PhoneSize = isCompactPhone ? 'compact' : isStandardPhone ? 'standard' : 'large';

  const gutter = isCompactPhone ? 16 : 20;
  const cardPadding = isCompactPhone ? 14 : 16;
  const contentMaxWidth = 720;
  const contentWidth = Math.max(240, Math.min(width, contentMaxWidth) - gutter * 2);

  const scale = (size: number) => calcScale(size, width);
  const moderateScale = (size: number, factor = 0.5) => calcModerateScale(size, factor, width);
  const gridColumns = (minTileWidth: number, gap = 8) => {
    const columns = clamp(Math.floor((contentWidth + gap) / (minTileWidth + gap)), 1, 4);
    const tileWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
    return { columns, tileWidth };
  };

  return {
    width,
    height,
    breakpoint,
    orientation,
    deviceType,
    phoneSize,
    isPhone: deviceType === 'phone',
    isCompactPhone,
    isStandardPhone,
    isLargePhone,
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait',
    gutter,
    cardPadding,
    contentMaxWidth,
    contentWidth,
    scale,
    moderateScale,
    gridColumns,
  };
}

/**
 * Dynamically resolves a value based on the current active breakpoint.
 * e.g. useResponsiveValue({ base: 14, md: 18, lg: 22 })
 */
export function useResponsiveValue<T>(
  values: { base: T } & Partial<Record<Breakpoint, T>>
): T {
  const { breakpoint } = useResponsive();

  const orderedBreakpoints: Breakpoint[] = ['xl', 'lg', 'md', 'lgPhone', 'sm', 'xs'];
  const currentIndex = orderedBreakpoints.indexOf(breakpoint);

  for (let i = currentIndex; i < orderedBreakpoints.length; i++) {
    const bp = orderedBreakpoints[i];
    if (values[bp] !== undefined) {
      return values[bp] as T;
    }
  }

  return values.base;
}



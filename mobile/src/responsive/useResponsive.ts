import { useWindowDimensions } from 'react-native';
import {
  BREAKPOINTS,
  type Breakpoint,
  type DeviceType,
  type Orientation,
} from './breakpoints';

export interface ResponsiveInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  orientation: Orientation;
  deviceType: DeviceType;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
}

/**
 * Hook providing dynamic screen dimensions, breakpoint matching, and device classification.
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
  } else if (width >= BREAKPOINTS.sm) {
    breakpoint = 'sm';
  }

  let deviceType: DeviceType = 'phone';
  if (width >= BREAKPOINTS.lg) {
    deviceType = 'desktop';
  } else if (width >= BREAKPOINTS.md) {
    deviceType = 'tablet';
  }

  return {
    width,
    height,
    breakpoint,
    orientation,
    deviceType,
    isPhone: deviceType === 'phone',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait',
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

  const orderedBreakpoints: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs'];
  const currentIndex = orderedBreakpoints.indexOf(breakpoint);

  for (let i = currentIndex; i < orderedBreakpoints.length; i++) {
    const bp = orderedBreakpoints[i];
    if (values[bp] !== undefined) {
      return values[bp] as T;
    }
  }

  return values.base;
}


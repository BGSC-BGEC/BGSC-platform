export const BREAKPOINTS = {
  xs: 0,
  sm: 375,
  lgPhone: 412,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export type DeviceType = 'phone' | 'tablet' | 'desktop';

export type PhoneSize = 'compact' | 'standard' | 'large';

export type Orientation = 'portrait' | 'landscape';



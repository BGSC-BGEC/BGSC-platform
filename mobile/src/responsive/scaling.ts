import { Dimensions } from 'react-native';

// Guideline dimensions based on standard mobile viewport (e.g., iPhone 14 / 15 / Pixel 7)
export const GUIDELINE_BASE_WIDTH = 390;
export const GUIDELINE_BASE_HEIGHT = 844;

/**
 * Clamp a number between min and max bounds.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Linearly scales a size based on current screen width (clamped to [0.88, 1.12] on phones).
 */
export function scale(size: number, width = Dimensions.get('window').width): number {
  const ratio = clamp(width / GUIDELINE_BASE_WIDTH, 0.88, 1.12);
  return Math.round(size * ratio);
}

/**
 * Linearly scales a size based on current screen height.
 */
export function verticalScale(size: number, height = Dimensions.get('window').height): number {
  const ratio = clamp(height / GUIDELINE_BASE_HEIGHT, 0.88, 1.15);
  return Math.round(size * ratio);
}

/**
 * Moderate scaling with a dampening factor (default: 0.5).
 * Prevents elements and fonts from blowing up too large on large screens or shrinking too far on 360px phones.
 */
export function moderateScale(size: number, factor = 0.5, width = Dimensions.get('window').width): number {
  const scaled = (width / GUIDELINE_BASE_WIDTH) * size;
  const moderated = size + (scaled - size) * factor;
  return Math.round(clamp(moderated, size * 0.88, size * 1.12));
}



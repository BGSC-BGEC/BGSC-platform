import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline dimensions based on standard standard mobile viewport (e.g., iPhone 14 / 15 / Pixel 7)
const GUIDELINE_BASE_WIDTH = 390;
const GUIDELINE_BASE_HEIGHT = 844;

/**
 * Linearly scales a size based on screen width.
 */
export function scale(size: number): number {
  return Math.round((SCREEN_WIDTH / GUIDELINE_BASE_WIDTH) * size);
}

/**
 * Linearly scales a size based on screen height.
 */
export function verticalScale(size: number): number {
  return Math.round((SCREEN_HEIGHT / GUIDELINE_BASE_HEIGHT) * size);
}

/**
 * Moderate scaling with a dampening factor (default: 0.5).
 * Prevents elements and fonts from blowing up too large on tablets.
 */
export function moderateScale(size: number, factor = 0.5): number {
  return Math.round(size + (scale(size) - size) * factor);
}

/**
 * Clamp a number between min and max bounds.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}


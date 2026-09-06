import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme } from '../theme/ThemeProvider';
import type { UIThemeColors } from '../theme/colors';

export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export const ICON_SIZES = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
} as const;

export type IconSizeKey = keyof typeof ICON_SIZES;

/** Semantic aliases for common UI actions */
export const ICON_ALIASES: Record<string, IoniconsName> = {
  // Navigation & Chevrons
  back: 'arrow-back',
  forward: 'arrow-forward',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'chevron-left': 'chevron-back',
  'chevron-right': 'chevron-forward',
  close: 'close',
  menu: 'menu',

  // Actions
  search: 'search-outline',
  filter: 'filter-outline',
  plus: 'add',
  minus: 'remove',
  check: 'checkmark',
  edit: 'create-outline',
  delete: 'trash-outline',
  share: 'share-social-outline',
  refresh: 'reload-outline',
  copy: 'copy-outline',

  // Forms & Auth
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
  lock: 'lock-closed-outline',
  mail: 'mail-outline',
  phone: 'call-outline',
  user: 'person-outline',

  // Status & Feedback
  'alert-circle': 'alert-circle-outline',
  'check-circle': 'checkmark-circle-outline',
  'info-circle': 'information-circle-outline',
  warning: 'warning-outline',

  // Features
  calendar: 'calendar-outline',
  trophy: 'trophy-outline',
  star: 'star',
  'star-outline': 'star-outline',
  heart: 'heart',
  'heart-outline': 'heart-outline',
  bell: 'notifications-outline',
  settings: 'settings-outline',
  camera: 'camera-outline',
  image: 'image-outline',
  store: 'bag-handle-outline',
  sparkles: 'sparkles-outline',
};

export type IconAliasName = keyof typeof ICON_ALIASES;
export type IconName = IconAliasName | IoniconsName;

export interface IconProps {
  name: IconName;
  size?: IconSizeKey | number;
  color?: keyof UIThemeColors | string;
  style?: object;
}

/**
 * Unified, theme-aware Icon component wrapping @expo/vector-icons.
 */
export function Icon({
  name,
  size = 'md',
  color = 'text',
  style,
}: IconProps) {
  const { colors } = useTheme();

  // Resolve pixel size
  const pixelSize = typeof size === 'number' ? size : ICON_SIZES[size];

  // Resolve color
  const resolvedColor =
    color in colors ? colors[color as keyof UIThemeColors] : color;

  // Resolve alias
  const resolvedName: IoniconsName = (ICON_ALIASES[name] ?? name) as IoniconsName;

  return <Ionicons name={resolvedName} size={pixelSize} color={resolvedColor} style={style} />;
}


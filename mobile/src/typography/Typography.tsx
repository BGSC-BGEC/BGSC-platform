import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  StyleSheet,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import {
  TYPOGRAPHY_STYLES,
  type TypographyVariant,
} from '../theme/typography';
import type { UIThemeColors } from '../theme/colors';

export type TextColorKey = keyof Pick<
  UIThemeColors,
  | 'text'
  | 'textMuted'
  | 'textSubtle'
  | 'primary'
  | 'primaryText'
  | 'secondary'
  | 'secondaryText'
  | 'accent'
  | 'accentText'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
>;

export interface TypographyProps extends RNTextProps {
  children?: React.ReactNode;
  variant?: TypographyVariant;
  color?: TextColorKey | string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  style?: TextStyle | TextStyle[];
  tabular?: boolean;
}

/**
 * Unified Typography component enforcing non-"vibe-coded", consistent font scales,
 * line heights, letter spacings, and semantic color resolution.
 */
export function Typography({
  children,
  variant = 'body',
  color = 'text',
  align,
  style,
  tabular = false,
  maxFontSizeMultiplier = 1.35,
  ...rest
}: TypographyProps) {
  const { colors } = useTheme();

  // Resolve color: if color is a key on colors, use that; otherwise use raw string
  const resolvedColor =
    color in colors ? colors[color as keyof UIThemeColors] : color;

  const baseStyle = TYPOGRAPHY_STYLES[variant];

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        baseStyle,
        { color: resolvedColor },
        align ? { textAlign: align } : undefined,
        tabular ? styles.tabular : undefined,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

/** Pre-configured Heading component for h1, h2, h3, h4 */
export function Heading({
  level = 1,
  ...props
}: Omit<TypographyProps, 'variant'> & { level?: 1 | 2 | 3 | 4 }) {
  const variant: TypographyVariant = `h${level}` as TypographyVariant;
  return <Typography variant={variant} {...props} />;
}

/** Standard Body Text */
export function Text(props: TypographyProps) {
  return <Typography variant="body" {...props} />;
}

/** Uppercase tracked form/section Label */
export function Label({
  size = 'normal',
  ...props
}: Omit<TypographyProps, 'variant'> & { size?: 'normal' | 'small' }) {
  return (
    <Typography
      variant={size === 'small' ? 'labelSmall' : 'label'}
      color="textMuted"
      {...props}
    />
  );
}

/** Small metadata / timestamp caption */
export function Caption(props: TypographyProps) {
  return <Typography variant="caption" color="textMuted" {...props} />;
}

/** Tabular-numeric monospace text for timers, scores, codes */
export function Mono(props: TypographyProps) {
  return <Typography variant="mono" tabular {...props} />;
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});


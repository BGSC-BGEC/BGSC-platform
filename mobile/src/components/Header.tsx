import React from 'react';
import {
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from '../icons/IconButton';
import { Typography } from '../typography/Typography';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
  blur?: boolean;
  transparent?: boolean;
  style?: ViewStyle;
}

export function Header({
  title,
  subtitle,
  onBack,
  leftAction,
  rightActions,
  blur = true,
  transparent = false,
  style,
}: HeaderProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: transparent
            ? 'transparent'
            : blur
            ? 'transparent'
            : colors.background,
          borderBottomColor: transparent ? 'transparent' : colors.border,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      {blur && !transparent && (
        <BlurView
          intensity={60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.contentRow}>
        <View style={styles.leftSlot}>
          {onBack ? (
            <IconButton
              icon="back"
              variant="ghost"
              size="sm"
              accessibilityLabel="Go back"
              onPress={onBack}
            />
          ) : (
            leftAction
          )}
        </View>

        <View style={styles.centerSlot}>
          {title && (
            <Typography
              variant="h2"
              color="text"
              numberOfLines={1}
              style={styles.title}
            >
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography
              variant="caption"
              color="textMuted"
              numberOfLines={1}
              style={styles.subtitle}
            >
              {subtitle}
            </Typography>
          )}
        </View>

        <View style={styles.rightSlot}>{rightActions}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 50,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftSlot: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 2,
  },
  rightSlot: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});


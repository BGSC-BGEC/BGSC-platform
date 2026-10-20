import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { resolveMediaUrl } from '../api/config';
import { initials } from '../utils/format';

export interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Fallback background (defaults to solid primary) */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Circular avatar with an orange initials fallback (same as the profile header). */
export function Avatar({ name, uri, size = 40, color, style }: AvatarProps) {
  const { colors } = useTheme();
  const source = resolveMediaUrl(uri);
  const radius = size / 2;

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius, backgroundColor: color ?? colors.primarySolid },
        style,
      ]}
    >
      {source ? (
        <Image source={{ uri: source }} style={{ width: size, height: size, borderRadius: radius }} contentFit="cover" />
      ) : (
        <Typography
          variant="button"
          color="primaryText"
          style={{ fontSize: Math.max(11, size * 0.33), lineHeight: Math.max(14, size * 0.5) }}
        >
          {initials(name)}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

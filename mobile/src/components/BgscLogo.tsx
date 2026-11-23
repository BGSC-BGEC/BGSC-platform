import React from 'react';
import type { StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';

const LOGO = require('../../assets/images/bgsc-logo.png');

/** The round BGSC crest. Square; `size` is its width and height in points. */
export function BgscLogo({ size = 32, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel="BGSC logo"
      accessible
    />
  );
}

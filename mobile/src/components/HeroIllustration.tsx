import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

/** Clubhouse + sports/gaming illustration (transparent PNG, 789×570). */
const CLUBHOUSE = require('../../assets/images/hero-clubhouse.png');
export const HERO_ILLUSTRATION_ASPECT = 789 / 570;

export interface HeroIllustrationProps {
  width: number;
  style?: StyleProp<ViewStyle>;
}

/** Hero artwork, static, at its original aspect ratio. */
export function HeroIllustration({ width, style }: HeroIllustrationProps) {
  return (
    <View pointerEvents="none" style={[{ width, height: width / HERO_ILLUSTRATION_ASPECT }, style]}>
      <Image source={CLUBHOUSE} style={StyleSheet.absoluteFill} contentFit="contain" />
    </View>
  );
}

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BrandMark } from '../../src/auth/BrandMark';
import { Badge } from '../../src/components/Badge';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

/** v2 Splash (55:1979) — shown while the stored session is restored. */
export default function SplashScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} accessibilityLabel="Loading BGSC">
      {/* Warm orange glow fading to the slate background */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 390 844">
        <Defs>
          <RadialGradient id="splash-glow" cx="195" cy="352" rx="195" ry="703" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#6B3D24" />
            <Stop offset="0.5" stopColor="#4B372D" />
            <Stop offset="1" stopColor="#2B3036" />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="844" fill="url(#splash-glow)" />
      </Svg>

      <View style={styles.center}>
        <BrandMark size="lg" />
        <Typography variant="body" color="textMuted" style={styles.tagline}>
          BITS Goa Sports Community
        </Typography>
        <View style={styles.pills}>
          <Badge label="BGEC" variant="info" />
          <Badge label="FitSoc" variant="success" />
          <Badge label="Leagues" variant="primary" />
        </View>
      </View>
      <LoadingDots color={colors.primary} />
    </View>
  );
}

/** Three dots pulsing in turn. */
function LoadingDots({ color }: { color: string }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        180,
        anims.map((a) =>
          Animated.sequence([
            Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(a, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [anims]);
  return (
    <View style={styles.dots}>
      {anims.map((opacity, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color, opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 56 },
  center: { alignItems: 'center', gap: 20 },
  tagline: { fontSize: 15 },
  pills: { flexDirection: 'row', gap: 8 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 40, height: 48, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

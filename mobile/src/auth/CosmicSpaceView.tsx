import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { DEFAULT_ASTRONAUT_IMAGE } from '../assets/astronaut';

export { DEFAULT_ASTRONAUT_IMAGE };

interface StarData {
  id: number;
  xPercent: number;
  yPercent: number;
  size: number;
  baseOpacity: number;
  color: string;
  isSparkle: boolean;
  group: 1 | 2;
}

const STAR_COLORS = ['#ffffff', '#e0f2fe', '#fdf4ff', '#fbcfe8', '#bae6fd', '#fed7aa'];

interface SubtleShootingStarProps {
  id: string;
  delayMs: number;
  intervalMs: number;
  durationMs?: number;
  startX: number;
  startY: number;
  travelDistance?: number;
  length?: number;
}

/**
 * Subtle shooting star: a delicate, glowing linear streak gliding diagonally from
 * top-left to bottom-right across the dark background, matching the original web effect.
 */
export function SubtleShootingStar({
  id,
  delayMs,
  intervalMs,
  durationMs = 900,
  startX,
  startY,
  travelDistance = 180,
  length = 80,
}: SubtleShootingStarProps) {
  const anim = useRef(new Animated.Value(0)).current;

  // Running diagonally from left to right (42-degree angle)
  const angleDeg = '42deg';
  const angleRad = (42 * Math.PI) / 180;
  const travelX = Math.cos(angleRad) * travelDistance;
  const travelY = Math.sin(angleRad) * travelDistance;

  useEffect(() => {
    let timer: any;
    let isMounted = true;

    const streak = () => {
      if (!isMounted) return;
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.bezier(0.25, 0.4, 0.25, 1),
        useNativeDriver: true,
      }).start(() => {
        if (isMounted) {
          timer = setTimeout(streak, intervalMs + Math.random() * 800);
        }
      });
    };

    timer = setTimeout(streak, delayMs);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [anim, delayMs, intervalMs, durationMs]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travelX],
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travelY],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.65, 1],
    outputRange: [0, 0.8, 0.7, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.meteorWrap,
        {
          left: startX,
          top: startY,
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotate: angleDeg },
          ],
        },
      ]}
    >
      <Svg width={length + 10} height={6} viewBox={`0 0 ${length + 10} 6`}>
        <Defs>
          <LinearGradient id={`subtleStreak-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="60%" stopColor="#FED7AA" stopOpacity={0.35} />
            <Stop offset="90%" stopColor="#FFFFFF" stopOpacity={0.85} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={1} />
          </LinearGradient>
        </Defs>

        {/* Subtle 1.6px tapered line streak */}
        <Path
          d={`M 0 3 L ${length} 3`}
          stroke={`url(#subtleStreak-${id})`}
          strokeWidth={1.6}
          strokeLinecap="round"
        />

        {/* Soft pinpoint leading head */}
        <Circle cx={length} cy={3} r={1.2} fill="#FFFFFF" opacity={0.9} />
      </Svg>
    </Animated.View>
  );
}

// Backward-compatible alias for any existing imports
export const FallingMeteor = SubtleShootingStar;
export function MeteorShowerOverlay() {
  return null;
}

/**
 * 100% Native Starfield:
 * High-performance vector stars with subtle twinkling and animated shooting stars.
 * Works natively on iOS, Android, and Web without canvas or DOM dependencies.
 */
function NativeCosmicStarfield() {
  const { width, height } = useWindowDimensions();

  // Generate a deterministic constellation of stars
  const stars: StarData[] = useMemo(() => {
    const list: StarData[] = [];
    const count = 72;
    for (let i = 0; i < count; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd1 = seed / 233280;
      const seed2 = (seed * 9301 + 49297) % 233280;
      const rnd2 = seed2 / 233280;
      const seed3 = (seed2 * 9301 + 49297) % 233280;
      const rnd3 = seed3 / 233280;

      const isSparkle = i % 7 === 0;
      list.push({
        id: i,
        xPercent: rnd1 * 100,
        yPercent: rnd2 * 85,
        size: isSparkle ? 2.4 : rnd3 * 1.5 + 0.8,
        baseOpacity: isSparkle ? 0.75 : rnd3 * 0.5 + 0.3,
        color: STAR_COLORS[i % STAR_COLORS.length],
        isSparkle,
        group: i % 2 === 0 ? 1 : 2,
      });
    }
    return list;
  }, []);

  // Twinkle animations
  const twinkle1 = useRef(new Animated.Value(0.4)).current;
  const twinkle2 = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle1, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle1, {
          toValue: 0.35,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle2, {
          toValue: 0.3,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle2, {
          toValue: 0.95,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [twinkle1, twinkle2]);

  const group1Stars = stars.filter((s) => s.group === 1);
  const group2Stars = stars.filter((s) => s.group === 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Group 1 Stars */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkle1 }]}>
        <Svg width="100%" height="100%">
          {group1Stars.map((s) =>
            s.isSparkle ? (
              <Path
                key={s.id}
                d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
                fill={s.color}
                opacity={s.baseOpacity}
                transform={`translate(${(s.xPercent * width) / 100}, ${(s.yPercent * height) / 100}) scale(${s.size / 16})`}
              />
            ) : (
              <Circle
                key={s.id}
                cx={`${s.xPercent}%`}
                cy={`${s.yPercent}%`}
                r={s.size}
                fill={s.color}
                opacity={s.baseOpacity}
              />
            )
          )}
        </Svg>
      </Animated.View>

      {/* Group 2 Stars */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkle2 }]}>
        <Svg width="100%" height="100%">
          {group2Stars.map((s) =>
            s.isSparkle ? (
              <Path
                key={s.id}
                d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
                fill={s.color}
                opacity={s.baseOpacity}
                transform={`translate(${(s.xPercent * width) / 100}, ${(s.yPercent * height) / 100}) scale(${s.size / 16})`}
              />
            ) : (
              <Circle
                key={s.id}
                cx={`${s.xPercent}%`}
                cy={`${s.yPercent}%`}
                r={s.size}
                fill={s.color}
                opacity={s.baseOpacity}
              />
            )
          )}
        </Svg>
      </Animated.View>

      {/* Subtle shooting stars running diagonally from left to right */}
      <SubtleShootingStar
        id="streak-1"
        delayMs={600}
        intervalMs={3600}
        durationMs={850}
        startX={width * 0.12}
        startY={height * 0.08}
        travelDistance={190}
        length={85}
      />
      <SubtleShootingStar
        id="streak-2"
        delayMs={2400}
        intervalMs={4400}
        durationMs={920}
        startX={width * 0.38}
        startY={height * 0.18}
        travelDistance={210}
        length={90}
      />
      <SubtleShootingStar
        id="streak-3"
        delayMs={4800}
        intervalMs={4800}
        durationMs={880}
        startX={width * 0.05}
        startY={height * 0.28}
        travelDistance={170}
        length={75}
      />
    </View>
  );
}

export function CosmicSpaceBackground({
  showAstronaut = true,
  astronautTop = 40,
  astronautRight = 10,
  astronautScale = 0.85,
}: {
  showAstronaut?: boolean;
  astronautTop?: number;
  astronautRight?: number;
  astronautScale?: number;
}) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#03060f' }]} />

      {/* Horizon Solar Glow (Atmospheric Backdrop) */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="horizon-glow" cx="195" cy="844" rx="260" ry="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#f97316" stopOpacity="0.85" />
            <Stop offset="0.3" stopColor="#ea580c" stopOpacity="0.6" />
            <Stop offset="0.6" stopColor="#0891b2" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#03060f" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="550" width="390" height="294" fill="url(#horizon-glow)" />
      </Svg>

      {/* Native Twinkling Starfield & Animated Falling Meteors */}
      <NativeCosmicStarfield />

      {/* Floating Astronaut Companion */}
      {showAstronaut && (
        <Animated.View
          style={[
            styles.astronautWrap,
            {
              top: astronautTop,
              right: astronautRight,
              transform: [{ translateY: floatAnim }, { scale: astronautScale }],
            },
          ]}
        >
          <Image source={{ uri: DEFAULT_ASTRONAUT_IMAGE }} style={styles.astronautImage} resizeMode="contain" />
          <Animated.View style={[styles.sparkleStar, { transform: [{ scale: pulseAnim }] }]}>
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="#ff4bb8">
              <Path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

export function GlassCard({
  children,
  style,
  borderRadius = 20,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  borderRadius?: number;
}) {
  return (
    <View style={[styles.glassBorder, { borderRadius }, style]}>
      <BlurView intensity={28} tint="dark" style={[styles.glassBlur, { borderRadius }]}>
        <View style={styles.glassTint}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  meteorWrap: {
    position: 'absolute',
    zIndex: 5,
  },
  astronautWrap: {
    position: 'absolute',
    width: 100,
    height: 100,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  astronautImage: {
    width: 86,
    height: 86,
  },
  sparkleStar: {
    position: 'absolute',
    top: 14,
    right: 8,
  },
  glassBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  glassBlur: {
    overflow: 'hidden',
  },
  glassTint: {
    backgroundColor: 'rgba(10, 15, 28, 0.72)',
    padding: 16,
  },
});

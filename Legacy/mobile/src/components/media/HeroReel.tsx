import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FadeOverlay } from '@/components/media/FadeOverlay';
import { FONTS } from '@/core/theme/fonts';
import type { MediaReel } from '@/core/repositories/MediaRepository';
import { useColors } from '@/hooks/use-colors';

interface HeroReelProps {
  reels: MediaReel[];
  onOpen: (reel: MediaReel) => void;
}

/**
 * Auto-playing featured reel (media-page-design.md §4). No video backend and
 * no expo-av/expo-video dependency yet, so each reel renders a slow Ken Burns
 * zoom over the featured still — the design's own fallback (§4.1: "static
 * featured image with the same overlay treatment") plus motion.
 *
 * TODO(media): swap the image for <Video isLooping isMuted shouldPlay> driven
 * by useFocusEffect (play on focus, pause on blur) once real reel assets
 * exist; add the mute/unmute toggle (design §4.1) alongside it. Swipe
 * navigation is a paging ScrollView — dots below.
 */
export function HeroReel({ reels, onOpen }: HeroReelProps) {
  const { width: screenWidth } = useWindowDimensions();
  const colors = useColors();
  const [activeIndex, setActiveIndex] = useState(0);
  const height = Math.min(screenWidth * (9 / 16), screenWidth * 0.55);

  if (reels.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth))}
        style={{ height }}
      >
        {reels.map((reel) => (
          <Pressable
            key={reel.id}
            onPress={() => onOpen(reel)}
            accessibilityRole="button"
            accessibilityLabel={`${reel.eventName} — ${reel.title}, featured video`}
            style={({ pressed }) => [{ width: screenWidth, height, opacity: pressed ? 0.92 : 1 }]}
          >
            <KenBurnsImage uri={reel.imageUri} />

            {/* Bottom fade for pill legibility (design §4.1, bottom ~35%). */}
            <FadeOverlay fraction={0.35} />

            <View style={[styles.featuredBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeText, { color: colors.accentText }]}>FEATURED</Text>
            </View>

            <BlurView intensity={45} tint="dark" style={[styles.eventPill, { borderColor: colors.border }]} experimentalBlurMethod="dimezisBlurView">
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.5 }]} />
              <Ionicons name="play" size={14} color={colors.accentText} />
              <Text numberOfLines={1} style={[styles.eventName, { color: colors.text }]}>
                {reel.eventName} — {reel.title}
              </Text>
            </BlurView>
          </Pressable>
        ))}
      </ScrollView>

      {reels.length > 1 ? (
        <View style={styles.dots}>
          {reels.map((reel, i) => (
            <View
              key={reel.id}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? colors.accent : colors.border,
                  width: i === activeIndex ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Slow zoom loop (scale 1 → 1.08 → 1, ~18 s) standing in for video motion. */
function KenBurnsImage({ uri }: { uri: string }) {
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const appState = useRef(AppState.currentState);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // H-20: stop the animation when the app is backgrounded to avoid battery
    // drain from a continuously running loop. Also respect Reduce Motion.
    if (reducedMotion) return;

    const startLoop = () => {
      loopRef.current?.stop();
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 9000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 9000, useNativeDriver: true }),
        ]),
      );
      loopRef.current.start();
    };

    startLoop();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && appState.current !== 'active') {
        startLoop();
      } else if (nextState !== 'active') {
        loopRef.current?.stop();
        scale.setValue(1);
      }
      appState.current = nextState;
    });

    return () => {
      loopRef.current?.stop();
      sub.remove();
    };
  }, [scale, reducedMotion]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  eventPill: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: '80%',
  },
  eventName: {
    fontFamily: FONTS.heading,
    fontSize: 15,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

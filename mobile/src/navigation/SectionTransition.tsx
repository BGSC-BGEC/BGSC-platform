import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const DURATION = 260;
const RISE = 14;

/**
 * Fades and lifts a navigator's screen in when it becomes the active one (e.g. picking a section
 * in the sidebar), which otherwise swaps instantly. Keyed on the parent navigator's active route,
 * so coming back from a pushed screen (which has its own slide) doesn't replay it.
 */
export function SectionTransition({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const isActive = useNavigationState((state) => state.routes[state.index]?.key === routeKey);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const wasActive = useRef(isActive);

  useEffect(() => {
    if (isActive && !wasActive.current && !reduceMotion) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
    }
    wasActive.current = isActive;
  }, [isActive, reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * RISE }],
  }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

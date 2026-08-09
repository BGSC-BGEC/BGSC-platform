import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/core/theme/fonts';
import { useThemeStore } from '@/core/stores/themeStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Glass bottom sheet (master doc §7.5): top corners 24, heavy blur (~32px ≈
 * intensity 80), 40×4 drag handle, rgba(0,0,0,0.55) scrim. Spring-in
 * (tension 90, friction 14); dismiss via scrim tap, ✕, or swipe down.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const preference = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  const blurTint: 'light' | 'dark' = (preference === 'system' ? system : preference) === 'light' ? 'light' : 'dark';
  const [translateY] = useState(() => new Animated.Value(600));
  const [scrimOpacity] = useState(() => new Animated.Value(0));

  // Latest onClose for the pan responder (created once, never recreated).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Lazy ref init (React docs pattern) — PanResponder must be created once.
  const panRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (panRef.current === null) {
    // eslint-disable-next-line react-hooks/refs -- guarded lazy-init write; handlers run on gestures, never in render
    panRef.current = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          onCloseRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 90,
            friction: 14,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }
  const pan = panRef.current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 14,
        useNativeDriver: true,
      }).start();
      Animated.timing(scrimOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateY, { toValue: 600, duration: 260, useNativeDriver: true }).start();
      Animated.timing(scrimOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, translateY, scrimOpacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: scrimOpacity }]}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          // eslint-disable-next-line react-hooks/refs -- pan responders are stable imperative handles, safe to spread
          {...pan.panHandlers}
          style={[styles.sheet, { transform: [{ translateY }], borderColor: colors.border, paddingBottom: Math.max(32, insets.bottom + 16) }]}
        >
          <BlurView intensity={80} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 22,
  },
  close: {
    padding: 8,
  },
});

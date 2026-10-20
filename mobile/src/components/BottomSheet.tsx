import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Tapping the scrim closes the sheet (default true) */
  dismissOnBackdrop?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Fires once the close animation has finished and the Modal is gone (open popups after this on iOS). */
  onClosed?: () => void;
}

const DURATION = 220;
const OFFSCREEN = 600;

/** v2 bottom sheet — dimmed scrim, grabber, surface card pinned to the bottom. */
export function BottomSheet({
  visible,
  onClose,
  dismissOnBackdrop = true,
  children,
  style,
  onClosed,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  // Keep the Modal mounted until the close animation finishes.
  const [mounted, setMounted] = useState(visible);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const wasVisible = useRef(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    // Only a real open → close fires onClosed (not the initial closed mount).
    const closing = wasVisible.current && !visible;
    wasVisible.current = visible;
    let timer: ReturnType<typeof setTimeout> | undefined;
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        // Give the native modal a beat to dismiss before anything else presents (iOS).
        if (closing) timer = setTimeout(() => onClosedRef.current?.(), 80);
      }
    });
    return () => clearTimeout(timer);
  }, [visible, progress]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onClose : undefined}
          accessibilityLabel="Close"
        />
      </Animated.View>
      {/* Lifts the sheet above the keyboard when it holds a field (e.g. team name). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + 32,
            },
            {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [OFFSCREEN, 0],
                  }),
                },
              ],
            },
            style,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0, 0, 0, 0.62)' },
  keyboard: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999 },
});

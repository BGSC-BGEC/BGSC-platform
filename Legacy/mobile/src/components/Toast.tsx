import { BlurView } from 'expo-blur';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

interface ToastOptions {
  /** Optional action link label (accent). */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

/**
 * Glass toast/snackbar (master doc §7.9): bottom of screen, glass surface
 * (blur 24px ≈ intensity 60), auto-dismiss after 2.8 s with fade, optional
 * accent action link. One at a time — queue internally.
 *
 * Refs are touched only inside handlers (never during render), so this is
 * React-Compiler clean.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(20));
  const queue = useRef<ToastItem[]>([]);
  const idRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (item: ToastItem) => {
    setToast(item);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(() => {
      if (timer.current) clearTimeout(timer.current);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setToast(null);
         
        const next = queue.current.shift();
        if (next) showToast(next);
      });
    }, 2800);
  };

  const show = (message: string, options: ToastOptions = {}) => {
    const item: ToastItem = { id: ++idRef.current, message, ...options };
    if (toast) {
      queue.current.push(item);
    } else {
      showToast(item);
    }
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer]}>
          <View style={[styles.toast, { borderColor: colors.border }]}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
            <Text style={[styles.message, { color: colors.text }]}>{toast.message}</Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  if (timer.current) clearTimeout(timer.current);
                  setToast(null);
                   
                  const next = queue.current.shift();
                  if (next) showToast(next);
                }}
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}
                hitSlop={8}
              >
                <Text style={[styles.action, { color: colors.accent }]}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  layer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 14,
    flexShrink: 1,
  },
  action: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});

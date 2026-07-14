import { useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  /** Array of image URIs — http/https URLs are rendered with expo-image; others show a placeholder. */
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewer({ visible, images, initialIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex);

  const goTo = (i: number) => setIdx(Math.max(0, Math.min(images.length - 1, i)));

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>

        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={16}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {/* Image counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{idx + 1} / {images.length}</Text>
          </View>
        )}

        {/* Zoomable image */}
        <ZoomableImage uri={images[idx] ?? ''} onClose={onClose} />

        {/* Dot strip */}
        {images.length > 1 && (
          <View style={styles.dotRow}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
            ))}
          </View>
        )}

        {/* Chevron navigation */}
        {idx > 0 && (
          <Pressable style={[styles.nav, styles.navLeft]} onPress={() => goTo(idx - 1)} hitSlop={16}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
        )}
        {idx < images.length - 1 && (
          <Pressable style={[styles.nav, styles.navRight]} onPress={() => goTo(idx + 1)} hitSlop={16}>
            <Text style={styles.navText}>›</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

// ── Zoomable single image ────────────────────────────────────────────────────

function ZoomableImage({ uri, onClose }: { uri: string; onClose: () => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const resetAll = () => {
    'worklet';
    scale.value = withSpring(1, { damping: 15 });
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.5), 5);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        resetAll();
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        // Pan within zoomed image
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        // Swipe-down to dismiss — only allow downward drag
        ty.value = Math.max(0, e.translationY);
      }
    })
    .onEnd((e) => {
      if (scale.value > 1.05) {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      } else if (e.translationY > 100 || e.velocityY > 1500) {
        runOnJS(onClose)();
      } else {
        ty.value = withSpring(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.5) {
        resetAll();
      } else {
        scale.value = withSpring(2.5, { damping: 12 });
        savedScale.value = 2.5;
      }
    });

  // Race: doubleTap takes priority over pan for finger-up events; pinch runs simultaneously
  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTap, pan),
    pinch,
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const isRealUri = uri.startsWith('http') || uri.startsWith('file://');

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.zoomWrap, animStyle]}>
        {isRealUri ? (
          <Image
            source={{ uri }}
            style={{ width: W, height: H * 0.78 }}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={styles.imgPlaceholder}>
            <Text style={styles.imgIcon}>🖼</Text>
            <Text style={styles.imgHint}>
              Pinch to zoom · Double-tap · Swipe down to close
            </Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  counter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 20,
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  zoomWrap: {
    width: W,
    height: H * 0.78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgPlaceholder: { alignItems: 'center', gap: 18 },
  imgIcon: { fontSize: 64, opacity: 0.7 },
  imgHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 36,
    lineHeight: 19,
  },

  dotRow: {
    position: 'absolute',
    bottom: 36,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 18 },

  nav: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: 10 },
  navRight: { right: 10 },
  navText: { color: '#fff', fontSize: 34, lineHeight: 40 },
});

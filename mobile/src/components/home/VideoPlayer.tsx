import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  /** Width of the video frame — measured by the parent carousel. */
  width: number;
  height?: number;
}

/**
 * Inline video player UI.
 *
 * Uses an Animated progress bar to simulate playback.
 * Wire `uri` to expo-video / expo-av once real video assets are available.
 */
export function VideoPlayer({ width, height = 220 }: Props) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const play = () => {
    setPlaying(true);
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: 30_000, // 30-second simulated video
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) {
        setPlaying(false);
        progress.setValue(0);
      }
    });
  };

  const pause = () => {
    setPlaying(false);
    animRef.current?.stop();
  };

  return (
    <View style={[styles.container, { width, height }]}>

      {/* Dark background */}
      <View style={styles.bg}>
        <Text style={styles.bgIcon}>🎬</Text>
        {!playing && <Text style={styles.bgLabel}>Video</Text>}
      </View>

      {/* Tap-to-pause full-area overlay — rendered below controls so controls stay interactive */}
      {playing && <Pressable style={StyleSheet.absoluteFill} onPress={pause} />}

      {/* Centre play button — only when paused */}
      {!playing && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={play}
          accessibilityLabel="Play video"
          accessibilityRole="button">
          <View style={styles.playBtnWrap}>
            <View style={styles.playBtn}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Muted badge */}
      {playing && muted && (
        <Pressable
          style={styles.mutedBadge}
          onPress={() => setMuted(false)}
          accessibilityLabel="Unmute">
          <Text style={styles.mutedText}>🔇  Tap to unmute</Text>
        </Pressable>
      )}

      {/* Controls bar */}
      {playing && (
        <View style={styles.controlsBar}>
          <Pressable onPress={pause} hitSlop={8} accessibilityLabel="Pause">
            <Text style={styles.controlIcon}>⏸</Text>
          </Pressable>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <Pressable
            onPress={() => setMuted((m) => !m)}
            hitSlop={8}
            accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
            <Text style={styles.controlIcon}>{muted ? '🔇' : '🔊'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0f0f1a',
  },

  bg: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bgIcon: { fontSize: 44, opacity: 0.55 },
  bgLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },

  playBtnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 24, marginLeft: 4 },

  mutedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mutedText: { color: '#fff', fontSize: 12 },

  controlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  controlIcon: { color: '#fff', fontSize: 18 },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});

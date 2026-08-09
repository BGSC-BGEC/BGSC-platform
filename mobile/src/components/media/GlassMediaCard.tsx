import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeOverlay } from '@/components/media/FadeOverlay';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface GlassMediaCardProps {
  uri: string;
  title: string;
  subtitle?: string;
  /** Width in dp — height = width / aspectRatio. */
  width: number;
  /** e.g. 3/4 (highlights), 1 (albums/sponsors), 16/9. */
  aspectRatio?: number;
  isVideo?: boolean;
  durationSec?: number;
  /** Top-left indicator icon (design §6.1: stacked-photos on album cards). */
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  /** Top-right round logo image (design §9: sponsor badge). */
  logoUri?: string;
  /** Highlights use Barlow Condensed 700; albums/sponsors Inter 600 (design §5/§6). */
  condensedTitle?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * Base card for strip sections (media-page-design.md §13.1): edge-to-edge
 * thumbnail, bottom fade, centred play indicator for videos, glass title
 * block. No borders/shadows on the image — chrome only as overlay.
 */
export function GlassMediaCard({
  uri,
  title,
  subtitle,
  width,
  aspectRatio = 3 / 4,
  isVideo = false,
  durationSec,
  badgeIcon,
  logoUri,
  condensedTitle = false,
  onPress,
  onLongPress,
  accessibilityLabel,
}: GlassMediaCardProps) {
  const colors = useColors();
  const height = width / aspectRatio;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}${isVideo ? ', video' : ''}`}
      style={({ pressed }) => [
        styles.card,
        { width, height, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />

      <FadeOverlay fraction={0.4} />

      {isVideo ? (
        <View style={styles.playIcon}>
          <Ionicons name="play" size={22} color={colors.accentText} />
        </View>
      ) : null}

      {badgeIcon ? (
        <View style={styles.badge}>
          <Ionicons name={badgeIcon} size={14} color={colors.accentText} />
        </View>
      ) : null}

      {logoUri ? (
        <Image source={{ uri: logoUri }} style={[styles.logo, { borderColor: colors.border }]} contentFit="cover" />
      ) : null}

      {durationSec !== undefined ? (
        <View style={styles.duration}>
          <Text style={[styles.durationText, { color: colors.accentText }]}>{formatDuration(durationSec)}</Text>
        </View>
      ) : null}

      <View style={styles.titleBlock}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.45 }]} />
        <Text
          numberOfLines={1}
          style={[condensedTitle ? styles.titleCondensed : styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -22 }, { translateY: -22 }],
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  duration: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  durationText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  titleBlock: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
  titleCondensed: {
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 11,
    marginTop: 1,
  },
});

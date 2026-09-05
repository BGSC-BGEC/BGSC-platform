import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface StackNavBarProps {
  title: string;
  onBack: () => void;
  /** Optional right-side action (share icon on challenge detail). */
  onShare?: () => void;
}

/**
 * Custom nav bar for stack screens (points spec §6.2 / §8): back arrow,
 * truncated title, optional share icon.
 */
export function StackNavBar({ title, onBack, onShare }: StackNavBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={styles.button}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {onShare ? (
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share challenge"
          hitSlop={8}
          style={styles.button}
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: FONTS.heading,
    fontSize: 20,
    textAlign: 'center',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

/**
 * Editorial section header (media-page-design.md §13.2): Bebas Neue 32sp
 * title (hero face — 32 sp+ per master §5.2), optional muted descriptor,
 * right-aligned accent "See all →" link.
 */
export function SectionHeader({ title, subtitle, onSeeAll }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.titleCol}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={`See all ${title.toLowerCase()}`}
          hitSlop={8}
          style={styles.seeAllBtn}
        >
          <Text style={[styles.seeAll, { color: colors.accent }]}>See all →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  titleCol: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.hero,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  seeAllBtn: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: -10,
  },
  seeAll: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
});

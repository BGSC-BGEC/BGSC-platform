import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

interface SectionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}

/**
 * Collapsible category section (hall-of-fame spec §7): tappable header with
 * icon + chevron, content toggled with a native LayoutAnimation. All sections
 * start expanded on first load.
 */
export function SectionCard({ icon, title, children }: SectionCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(true);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.section}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded }}
        style={styles.header}
      >
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    flex: 1,
  },
  content: {
    gap: 12,
  },
});

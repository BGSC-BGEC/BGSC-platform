import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export type MediaAction = 'download' | 'share' | 'report';

interface ActionContextSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Media being acted on — used for the sheet title. */
  title?: string;
  onAction: (action: MediaAction) => void;
}

/**
 * Long-press contextual sheet (media-page-design.md §17): Download · Share ·
 * Report. The screen owns the guest/auth branching (design §18 permission
 * logic) — this sheet is a dumb action list.
 */
export function ActionContextSheet({ visible, onClose, title, onAction }: ActionContextSheetProps) {
  const colors = useColors();

  const rows: { action: MediaAction; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { action: 'download', icon: 'download-outline', label: 'Download' },
    { action: 'share', icon: 'share-social-outline', label: 'Share' },
    { action: 'report', icon: 'flag-outline', label: 'Report' },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? 'Media'}>
      {rows.map((row) => (
        <Pressable
          key={row.action}
          onPress={() => onAction(row.action)}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name={row.icon} size={20} color={colors.text} />
          <Text style={[styles.label, { color: colors.text }]}>{row.label}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
});

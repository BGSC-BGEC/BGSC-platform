import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import type { ProofItem } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

export interface ProofUploadGridProps {
  items: ProofItem[];
  onChange: (items: ProofItem[]) => void;
  /** Completed submissions: no remove, no add, read-only placeholders. */
  readOnly?: boolean;
  onAdd: () => void;
}

/**
 * Proof upload grid (points spec §8.2): 3-column thumbnails, tap → full-screen
 * preview, long-press → Remove, trailing [+] tile. Link items render as cards.
 */
export function ProofUploadGrid({ items, onChange, readOnly = false, onAdd }: ProofUploadGridProps) {
  const colors = useColors();
  const [preview, setPreview] = useState<ProofItem | null>(null);

  const remove = (id: string) => {
    Alert.alert('Remove proof?', 'This item will be removed from your submission.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(items.filter((i) => i.id !== id)) },
    ]);
  };

  const openItem = (item: ProofItem) => {
    if (item.type === 'link') {
      // Links are URLs — open them rather than previewing.
      return;
    }
    setPreview(item);
  };

  if (items.length === 0 && readOnly) {
    return (
      <Text style={[styles.placeholder, { color: colors.textMuted }]}>
        No proof submitted
      </Text>
    );
  }

  return (
    <>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => openItem(item)}
            onLongPress={readOnly ? undefined : () => remove(item.id)}
            delayLongPress={350}
            accessibilityRole="button"
            accessibilityLabel={`Proof item ${item.type}`}
            style={styles.cell}
          >
            {item.type === 'link' ? (
              <View style={[styles.linkCard, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="link-outline" size={20} color={colors.accent} />
                <Text style={[styles.linkText, { color: colors.textMuted }]} numberOfLines={2}>
                  {hostOf(item.uri)}
                </Text>
              </View>
            ) : (
              <View>
                <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                {item.type === 'video' && (
                  <View style={styles.playOverlay} pointerEvents="none">
                    <Ionicons name="play-circle" size={28} color={colors.accentText} />
                  </View>
                )}
              </View>
            )}
          </Pressable>
        ))}
        {!readOnly && (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add proof"
            style={[styles.cell, styles.addTile, { borderColor: colors.borderActive }]}
          >
            <Ionicons name="add" size={28} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {items.length === 0 && !readOnly && (
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>
          Add photos, videos, or a link as proof
        </Text>
      )}

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={[styles.previewRoot, { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
          <Pressable
            onPress={() => setPreview(null)}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            style={styles.previewClose}
          >
            <Ionicons name="close" size={28} color={colors.accentText} />
          </Pressable>
          {preview ? (
            <Image source={{ uri: preview.uri }} style={styles.previewImage} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCard: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  linkText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
  },
  addTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 8,
  },
  previewRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});

import { ScrollView, Share, StyleSheet, Text, View, Pressable } from 'react-native';

import { useColors } from '@/hooks/use-colors';

import { BottomSheet } from './BottomSheet';
import { TAG_COLORS, relativeTime, type Announcement } from './types';

interface Props {
  announcement: Announcement | null;
  onClose: () => void;
}

export function AnnouncementDetailSheet({ announcement, onClose }: Props) {
  const colors = useColors();
  const visible = announcement !== null;

  const handleShare = async () => {
    if (!announcement) return;
    try {
      await Share.share({
        message: `${announcement.title}\n\n${announcement.body}`,
        title: announcement.title,
      });
    } catch {
      // share cancelled — no action needed
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.78}>
      {announcement && (
        <View style={styles.container}>
          {/* Tag row */}
          <View style={styles.tagRow}>
            {announcement.tags.map((tag) => (
              <View key={tag} style={[styles.tagPill, { backgroundColor: TAG_COLORS[tag] + '22', borderColor: TAG_COLORS[tag] }]}>
                <Text style={[styles.tagText, { color: TAG_COLORS[tag] }]}>{tag}</Text>
              </View>
            ))}
            <Text style={[styles.timestamp, { color: colors.textMuted }]}>
              {relativeTime(announcement.createdAt)}
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { color: colors.text }]}>{announcement.title}</Text>

            <View style={styles.authorRow}>
              <View style={[styles.avatar, { backgroundColor: announcement.author.avatarColor }]}>
                <Text style={styles.avatarText}>{announcement.author.avatarInitial}</Text>
              </View>
              <View>
                <Text style={[styles.authorName, { color: colors.text }]}>{announcement.author.name}</Text>
                <Text style={[styles.authorRole, { color: colors.textMuted }]}>{announcement.author.role}</Text>
              </View>
            </View>

            <Text style={[styles.body, { color: colors.text }]}>{announcement.body}</Text>
          </ScrollView>

          {/* Share button */}
          <Pressable
            style={[styles.shareBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share announcement">
            <Text style={[styles.shareBtnText, { color: colors.text }]}>↗  Share</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  timestamp: { fontSize: 12, marginLeft: 'auto' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  title: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 14 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  authorName: { fontSize: 14, fontWeight: '600' },
  authorRole: { fontSize: 12 },

  body: { fontSize: 15, lineHeight: 24 },

  shareBtn: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 14, fontWeight: '600' },
});

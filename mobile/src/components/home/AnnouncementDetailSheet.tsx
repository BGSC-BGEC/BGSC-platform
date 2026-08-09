import { Dimensions, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PillButton } from '@/components/PillButton';
import { CATEGORY_COLORS } from '@/core/theme/tokens';
import type { Announcement } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { absoluteDate } from './utils';

export interface AnnouncementDetailSheetProps {
  announcement: Announcement | null;
  onClose: () => void;
}

/**
 * Announcement detail (home-page.md H3): glass sheet, header metadata
 * (category pills + official + absolute date), title, author row, full body,
 * fixed Share footer. Share falls back to a text deep-link (home-page.md §8.2).
 */
export function AnnouncementDetailSheet({ announcement, onClose }: AnnouncementDetailSheetProps) {
  const colors = useColors();

  const share = () => {
    if (!announcement) return;
    // TODO(announcements): use a real deep link (bgsc://announcement/:id) once
    // linking is wired — §8.2 prefers deep link, text fallback is fine today.
    void Share.share({
      message: `${announcement.title}\n\n${announcement.body}`,
    });
  };

  return (
    <BottomSheet
      visible={announcement !== null}
      onClose={onClose}
      title="Announcement"
    >
      {announcement ? (
        <>
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.metaRow}>
              {announcement.tags.slice(0, 2).map((tag) => (
                <View
                  key={tag}
                  style={[styles.pill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: CATEGORY_COLORS[tag] ?? colors.accent },
                    ]}
                  />
                  <Text style={[styles.pillLabel, { color: colors.textMuted }]}>{tag}</Text>
                </View>
              ))}
              <Text style={[styles.official, { color: colors.textMuted }]}>Official</Text>
              <View style={styles.spacer} />
              <Text style={[styles.date, { color: colors.textMuted }]}>
                {absoluteDate(announcement.createdAt)}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{announcement.title}</Text>

            <View style={styles.authorRow}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: announcement.author.avatarColor ?? colors.accent },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.accentText }]}>
                  {announcement.author.avatarInitial}
                </Text>
              </View>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {announcement.author.name}
              </Text>
              <Text style={[styles.authorRole, { color: colors.textMuted }]}>
                {announcement.author.role}
              </Text>
            </View>

            <Text style={[styles.body, { color: colors.text }]}>{announcement.body}</Text>
          </ScrollView>

          <PillButton
            label="Share announcement"
            variant="ghost"
            onPress={share}
            accessibilityLabel="Share announcement"
            style={styles.share}
          />
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  official: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  spacer: {
    flex: 1,
  },
  date: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    lineHeight: 30,
    marginTop: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  authorName: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  authorRole: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 16,
    marginBottom: 8,
  },
  share: {
    marginTop: 12,
  },
});

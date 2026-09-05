import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { ChipFilter } from '@/components/ChipFilter';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { useToast } from '@/components/Toast';
import type { AnnouncementTag } from '@/core/types';
import { useCreateAnnouncement } from '@/hooks/use-announcements';
import { ANNOUNCEMENT_TAGS } from './types';

export interface MakeAnnouncementSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Make Announcement composer (home-page.md H4) — minimal first pass: title,
 * body, single category, Post. Draft survives failed submits (fields are kept
 * on close — §9.4). Trigger is role-gated by the parent (core+).
 *
 * TODO(announcements): rich-text toolbar (B/I/list/link), 120-char title
 * counter, optional 16:9 asset, scheduling — §9.2/§9.3 when the backend
 * contract lands.
 */
export function MakeAnnouncementSheet({ visible, onClose }: MakeAnnouncementSheetProps) {
  const toast = useToast();
  const create = useCreateAnnouncement();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<AnnouncementTag | null>(null);

  const valid = title.trim().length > 0 && body.trim().length > 0 && tag !== null;

  const post = () => {
    if (!valid || create.isPending) return;
    create.mutate(
      { title: title.trim().slice(0, 120), body: body.trim(), tags: tag ? [tag] : [] },
      {
        onSuccess: () => {
          toast.show('Announcement published.');
          onClose();
        },
        onError: (err) => {
          // Draft preserved (fields untouched) — §9.4.
          toast.show(err instanceof Error ? err.message : 'Could not publish. Try again.');
        },
      },
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="New Announcement">
      <View style={styles.form}>
        <GlassInput
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Announcement title"
          accessibilityLabel="Announcement title"
        />
        <GlassInput
          label="Body"
          value={body}
          onChangeText={setBody}
          placeholder="What should the campus know?"
          multiline
          accessibilityLabel="Announcement body"
        />
        <View style={styles.categories}>
          <View style={styles.chips}>
            <ChipFilter
              options={ANNOUNCEMENT_TAGS.map((t) => ({ label: t, value: t }))}
              value={tag}
              onChange={setTag}
              variant="tag"
              accessibilityLabel="Announcement categories"
            />
          </View>
        </View>
        <View style={styles.actions}>
          <PillButton label="Cancel" variant="ghost" onPress={onClose} accessibilityLabel="Cancel" style={styles.cancel} />
          <PillButton
            label="Post"
            onPress={post}
            loading={create.isPending}
            disabled={!valid}
            accessibilityLabel="Post announcement"
            style={styles.post}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
    paddingBottom: 8,
  },
  categories: {
    gap: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancel: {
    flex: 1,
  },
  post: {
    flex: 1,
  },
});

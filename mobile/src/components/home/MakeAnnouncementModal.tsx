import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnnouncementRepository } from '@/core/repositories/AnnouncementRepository';
import { useColors } from '@/hooks/use-colors';

import { ALL_ANNOUNCEMENT_TAGS, TAG_COLORS, type AnnouncementTag } from './types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Maps a tag to "minutes remaining" when the WhatsApp rate limit is hit.
 * Empty record means no active rate limits.
 */
type RateLimitErrors = Partial<Record<AnnouncementTag, number>>;

export function MakeAnnouncementModal({ visible, onClose }: Props) {
  const colors = useColors();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<AnnouncementTag[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [rateLimitErrors, setRateLimitErrors] = useState<RateLimitErrors>({});

  const hasRateLimitErrors = Object.keys(rateLimitErrors).length > 0;
  const isValid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    selectedTags.length > 0 &&
    !hasRateLimitErrors;

  // Auto-clear rate-limit errors after 8 s (represents cooldown expiring in the demo).
  useEffect(() => {
    if (!hasRateLimitErrors) return;
    const timer = setTimeout(() => setRateLimitErrors({}), 8000);
    return () => clearTimeout(timer);
  }, [hasRateLimitErrors]);

  const toggleTag = (tag: AnnouncementTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    // Dismiss a rate-limit error for a tag when it is deselected.
    if (rateLimitErrors[tag]) {
      setRateLimitErrors((prev) => {
        const next = { ...prev };
        delete next[tag];
        return next;
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setSelectedTags([]);
    setScheduled(false);
    setScheduleDate('');
    setSubmitCount(0);
    setRateLimitErrors({});
  };

  const handleDismiss = () => {
    if (title || body || selectedTags.length > 0) {
      Alert.alert('Discard draft?', 'Your unsaved announcement will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => { resetForm(); onClose(); },
        },
      ]);
    } else {
      onClose();
    }
  };

  const handlePost = async () => {
    setSubmitCount((c) => c + 1);

    // ── WhatsApp rate-limit simulation ───────────────────────────────────
    // On the 2nd+ submission attempt, BGEC triggers a rate limit (1 per hour).
    const newErrors: RateLimitErrors = {};
    if (submitCount >= 1 && selectedTags.includes('BGEC')) {
      newErrors['BGEC'] = 45;
    }
    if (Object.keys(newErrors).length > 0) {
      setRateLimitErrors(newErrors);
      return;
    }
    // ────────────────────────────────────────────────────────────────────

    setSubmitting(true);
    try {
      await AnnouncementRepository.create(title.trim(), body.trim(), selectedTags);
      resetForm();
      onClose();
    } catch (err) {
      Alert.alert('Failed to post', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.surface }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Announcement</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Title */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Title *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Announcement title"
            placeholderTextColor={colors.textMuted}
            maxLength={120}
            returnKeyType="next"
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{title.length}/120</Text>

          {/* Body */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Body *</Text>
          <TextInput
            style={[
              styles.input,
              styles.bodyInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your announcement here…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          {/* Tags */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Announcement type * (at least 1 required)
          </Text>
          <View style={styles.tagGrid}>
            {ALL_ANNOUNCEMENT_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              const tagColor = TAG_COLORS[tag];
              const rateLimitMinutes = rateLimitErrors[tag];
              return (
                <View key={tag}>
                  <Pressable
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.tagChip,
                      active
                        ? { backgroundColor: tagColor, borderColor: tagColor }
                        : { backgroundColor: tagColor + '15', borderColor: tagColor + '60' },
                      // Visually flag rate-limited active tags
                      rateLimitMinutes !== undefined && { borderColor: colors.danger, borderWidth: 2 },
                    ]}>
                    <Text style={[styles.tagChipText, { color: active ? '#fff' : tagColor }]}>
                      {tag}
                    </Text>
                  </Pressable>
                  {/* Inline rate-limit error — spec §8 Error States */}
                  {rateLimitMinutes !== undefined && (
                    <Text style={styles.rateLimitError}>
                      Rate limit reached — try again in {rateLimitMinutes} minutes.
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Rate-limit summary banner (if multiple tags affected) */}
          {hasRateLimitErrors && (
            <View style={[styles.rateLimitBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={styles.rateLimitBannerText}>
                ⚠️  WhatsApp broadcast is rate-limited for some tags above. The Post button will
                re-enable automatically once the cool-down expires.
              </Text>
            </View>
          )}

          {/* Schedule toggle */}
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Schedule for later</Text>
              <Text style={[styles.switchSub, { color: colors.textMuted }]}>
                {scheduled ? 'Set a date and time below' : 'Send immediately on post'}
              </Text>
            </View>
            <Switch
              value={scheduled}
              onValueChange={setScheduled}
              trackColor={{ true: colors.accent }}
              thumbColor={scheduled ? colors.accentText : '#f4f4f5'}
            />
          </View>

          {scheduled && (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Scheduled date & time</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={scheduleDate}
                onChangeText={setScheduleDate}
                placeholder="DD/MM/YYYY HH:MM"
                placeholderTextColor={colors.textMuted}
              />
            </>
          )}
        </ScrollView>

        {/* Footer actions */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            style={[styles.footerBtn, styles.cancelBtn, { borderColor: colors.border }]}
            onPress={handleDismiss}>
            <Text style={[styles.footerBtnText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerBtn,
              styles.postBtn,
              { backgroundColor: isValid && !submitting ? colors.primary : colors.border },
            ]}
            onPress={handlePost}
            disabled={!isValid || submitting}>
            <Text style={[styles.footerBtnText, { color: isValid && !submitting ? colors.primaryText : colors.textMuted }]}>
              {submitting ? 'Posting…' : scheduled ? 'Schedule' : 'Post'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  handle: { width: 40, height: 4, borderRadius: 2, marginTop: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  form: { padding: 16, gap: 6, paddingBottom: 24 },

  label: { fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  bodyInput: { minHeight: 120, paddingTop: 12 },
  charCount: { fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tagChipText: { fontSize: 13, fontWeight: '600' },

  rateLimitError: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 3,
    maxWidth: 140,
  },
  rateLimitBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  rateLimitBannerText: { fontSize: 13, color: '#b91c1c', lineHeight: 18 },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  switchSub: { fontSize: 12, marginTop: 2 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  cancelBtn: { borderWidth: 1 },
  postBtn: {},
  footerBtnText: { fontSize: 15, fontWeight: '600' },
});

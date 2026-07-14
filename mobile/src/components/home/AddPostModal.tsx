import { useState } from 'react';
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

import { useColors } from '@/hooks/use-colors';

type PostVisibility = 'Public' | 'Protected' | 'Private' | 'Non-Judgmental (24h)' | 'Close (24h)' | 'General (24h)';
type CommentVisibility = 'Public' | 'Private' | 'Protected';

const POST_VISIBILITIES: PostVisibility[] = [
  'Public',
  'Protected',
  'Private',
  'Non-Judgmental (24h)',
  'Close (24h)',
  'General (24h)',
];

const COMMENT_VISIBILITIES: CommentVisibility[] = ['Public', 'Private', 'Protected'];

const POST_TAGS = ['#event', '#sponsor', '#sports', '#esports', '#BGEC', '#FitSoc', '#community'];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AddPostModal({ visible, onClose }: Props) {
  const colors = useColors();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — Media
  const [mediaCount, setMediaCount] = useState(0);

  // Step 2 — Details
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPostTags, setSelectedPostTags] = useState<string[]>([]);

  // Step 3 — Privacy
  const [postVisibility, setPostVisibility] = useState<PostVisibility>('Public');
  const [likesEnabled, setLikesEnabled] = useState(true);
  const [showLikeCount, setShowLikeCount] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [commentVisibility, setCommentVisibility] = useState<CommentVisibility>('Public');
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const resetAll = () => {
    setStep(1);
    setMediaCount(0);
    setCaption('');
    setDescription('');
    setSelectedPostTags([]);
    setPostVisibility('Public');
    setLikesEnabled(true);
    setShowLikeCount(true);
    setCommentsEnabled(true);
    setCommentVisibility('Public');
    setSharingEnabled(true);
  };

  const handleClose = () => {
    if (mediaCount > 0 || caption || description) {
      Alert.alert('Discard post?', 'Your draft will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { resetAll(); onClose(); } },
      ]);
    } else {
      resetAll();
      onClose();
    }
  };

  const handlePost = async () => {
    setSubmitting(true);
    await new Promise<void>((r) => setTimeout(r, 800));
    setSubmitting(false);
    resetAll();
    onClose();
  };

  const togglePostTag = (tag: string) => {
    setSelectedPostTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const stepLabel = ['Media', 'Details', 'Privacy', 'Music'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top bar */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={[styles.topBarBtn, { color: colors.text }]}>✕</Text>
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.text }]}>New Post</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Step indicators */}
        <View style={[styles.stepBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, { backgroundColor: step >= s ? colors.accent : colors.border }]}>
                <Text style={[styles.stepDotText, { color: step >= s ? colors.accentText : colors.textMuted }]}>
                  {s}
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: step === s ? colors.accent : colors.textMuted }]}>
                {stepLabel[s - 1]}
              </Text>
            </View>
          ))}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* ── Step 1: Media ── */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>Select Media</Text>

                <View style={styles.mediaTiles}>
                  <Pressable
                    style={[styles.mediaTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setMediaCount((n) => Math.min(n + 1, 10))}>
                    <Text style={styles.mediaTileIcon}>📷</Text>
                    <Text style={[styles.mediaTileLabel, { color: colors.text }]}>Camera</Text>
                    <Text style={[styles.mediaTileSub, { color: colors.textMuted }]}>
                      Take a photo or video
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.mediaTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setMediaCount((n) => Math.min(n + 3, 10))}>
                    <Text style={styles.mediaTileIcon}>🖼️</Text>
                    <Text style={[styles.mediaTileLabel, { color: colors.text }]}>Gallery</Text>
                    <Text style={[styles.mediaTileSub, { color: colors.textMuted }]}>
                      Choose from your library
                    </Text>
                  </Pressable>
                </View>

                {/* Preview grid */}
                {mediaCount > 0 && (
                  <View style={styles.previewGrid}>
                    {Array.from({ length: mediaCount }).map((_, i) => (
                      <View key={i} style={[styles.previewThumb, { backgroundColor: colors.border }]}>
                        <Text style={{ color: colors.textMuted, fontSize: 22 }}>🖼</Text>
                        <Pressable
                          style={[styles.removeThumb, { backgroundColor: colors.primary }]}
                          onPress={() => setMediaCount((n) => n - 1)}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {mediaCount > 0 && (
                  <Text style={[styles.mediaCount, { color: colors.textMuted }]}>
                    {mediaCount}/10 selected
                  </Text>
                )}
              </View>
            )}

            {/* ── Step 2: Details ── */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>Post Details</Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Caption / Header</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption…"
                  placeholderTextColor={colors.textMuted}
                  maxLength={150}
                />
                <Text style={[styles.charHint, { color: colors.textMuted }]}>{caption.length}/150</Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Write something…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text style={[styles.charHint, { color: colors.textMuted }]}>{description.length}/2000</Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Tags</Text>
                <View style={styles.tagGrid}>
                  {POST_TAGS.map((tag) => {
                    const active = selectedPostTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => togglePostTag(tag)}
                        style={[
                          styles.tagChip,
                          active
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { borderColor: colors.border },
                        ]}>
                        <Text style={[styles.tagChipText, { color: active ? colors.accentText : colors.textMuted }]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Step 3: Privacy & Controls ── */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>Privacy & Interaction</Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Post Visibility</Text>
                {POST_VISIBILITIES.map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setPostVisibility(v)}
                    style={[
                      styles.radioRow,
                      { borderColor: postVisibility === v ? colors.accent : colors.border, backgroundColor: colors.surface },
                    ]}>
                    <View style={[styles.radioDot, { borderColor: postVisibility === v ? colors.accent : colors.border }]}>
                      {postVisibility === v && (
                        <View style={[styles.radioFill, { backgroundColor: colors.accent }]} />
                      )}
                    </View>
                    <Text style={[styles.radioLabel, { color: colors.text }]}>{v}</Text>
                  </Pressable>
                ))}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <SwitchRow
                  label="Likes enabled"
                  value={likesEnabled}
                  onChange={setLikesEnabled}
                  colors={colors}
                />
                <SwitchRow
                  label="Show like count"
                  value={showLikeCount}
                  onChange={setShowLikeCount}
                  colors={colors}
                  disabled={!likesEnabled}
                />
                <SwitchRow
                  label="Comments enabled"
                  value={commentsEnabled}
                  onChange={setCommentsEnabled}
                  colors={colors}
                />
                <SwitchRow
                  label="Sharing enabled"
                  value={sharingEnabled}
                  onChange={setSharingEnabled}
                  colors={colors}
                />

                {commentsEnabled && (
                  <>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 16 }]}>
                      Comment visibility
                    </Text>
                    {COMMENT_VISIBILITIES.map((v) => (
                      <Pressable
                        key={v}
                        onPress={() => setCommentVisibility(v)}
                        style={[
                          styles.radioRow,
                      { borderColor: commentVisibility === v ? colors.accent : colors.border, backgroundColor: colors.surface },
                    ]}>
                        <View style={[styles.radioDot, { borderColor: commentVisibility === v ? colors.accent : colors.border }]}>
                          {commentVisibility === v && (
                            <View style={[styles.radioFill, { backgroundColor: colors.accent }]} />
                          )}
                        </View>
                        <Text style={[styles.radioLabel, { color: colors.text }]}>{v}</Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── Step 4: Background Music (Future Feature) ── */}
            {step === 4 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>Background Music</Text>
                <View
                  style={[
                    styles.placeholderCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}>
                  <Text style={styles.placeholderIcon}>🎵</Text>
                  <Text style={[styles.placeholderTitle, { color: colors.text }]}>Coming Soon</Text>
                  <Text style={[styles.placeholderBody, { color: colors.textMuted }]}>
                    Add an audio track to play softly behind your post. This feature is in development
                    and will be available in a future update.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            {step > 1 && (
              <Pressable
                style={[styles.footerBtn, styles.backBtn, { borderColor: colors.border }]}
                onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}>
                <Text style={[styles.footerBtnText, { color: colors.text }]}>← Back</Text>
              </Pressable>
            )}

            {step < 4 ? (
              <Pressable
                style={[
                  styles.footerBtn,
                  styles.nextBtn,
                  {
                    backgroundColor:
                      step === 1 && mediaCount === 0 ? colors.border : colors.primary,
                    flex: step > 1 ? 1 : undefined,
                  },
                ]}
                onPress={() => setStep((s) => (s + 1) as 2 | 3 | 4)}
                disabled={step === 1 && mediaCount === 0}>
                <Text style={[styles.footerBtnText, { color: step === 1 && mediaCount === 0 ? colors.textMuted : colors.primaryText }]}>
                  Next →
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.footerBtn, styles.nextBtn, { backgroundColor: colors.primary }]}
                onPress={handlePost}
                disabled={submitting}>
                <Text style={[styles.footerBtnText, { color: colors.primaryText }]}>
                  {submitting ? 'Posting…' : 'Post'}
                </Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface SwitchRowProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof import('@/hooks/use-colors').useColors>;
  disabled?: boolean;
}

function SwitchRow({ label, value, onChange, colors, disabled }: SwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: disabled ? colors.textMuted : colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent }}
        thumbColor={value ? colors.accentText : '#f4f4f5'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarBtn: { fontSize: 20 },
  topBarTitle: { fontSize: 17, fontWeight: '700' },

  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontSize: 13, fontWeight: '700' },
  stepLabel: { fontSize: 11, fontWeight: '500' },

  content: { padding: 16, paddingBottom: 32 },
  stepContent: { gap: 8 },
  stepHeading: { fontSize: 20, fontWeight: '700', marginBottom: 8 },

  mediaTiles: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  mediaTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderStyle: 'dashed',
  },
  mediaTileIcon: { fontSize: 32 },
  mediaTileLabel: { fontSize: 15, fontWeight: '600' },
  mediaTileSub: { fontSize: 12, textAlign: 'center' },

  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  removeThumb: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCount: { fontSize: 12, textAlign: 'right' },

  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  multilineInput: { minHeight: 100, paddingTop: 12 },
  charHint: { fontSize: 11, alignSelf: 'flex-end', marginTop: 3 },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tagChipText: { fontSize: 13, fontWeight: '500' },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 8, height: 8, borderRadius: 4 },
  radioLabel: { fontSize: 14 },

  divider: { height: 1, marginVertical: 14 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  switchLabel: { fontSize: 15 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', flex: 1 },
  backBtn: { borderWidth: 1 },
  nextBtn: {},
  footerBtnText: { fontSize: 15, fontWeight: '600' },

  placeholderCard: {
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 10,
    padding: 32,
    marginTop: 8,
  },
  placeholderIcon: { fontSize: 48 },
  placeholderTitle: { fontSize: 18, fontWeight: '700' },
  placeholderBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

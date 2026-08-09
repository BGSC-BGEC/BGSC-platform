import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { SectionHeader } from '@/components/feedback/SectionHeader';
import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  EMAIL_RE,
  formatBytes,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_DESCRIPTION,
  MIN_DESCRIPTION,
  SEVERITY_OPTIONS,
  type FeedbackFormState,
} from '@/components/feedback/types';
import { GlassCard } from '@/components/GlassCard';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { useToast } from '@/components/Toast';
import { FONTS } from '@/core/theme/fonts';
import { SEVERITY_COLORS } from '@/core/theme/tokens';
import type {
  FeedbackAttachment,
  FeedbackTicket,
} from '@/core/repositories/FeedbackRepository';
import { useColors } from '@/hooks/use-colors';

export interface SubmitTicketTabProps {
  form: FeedbackFormState;
  onChange: (patch: Partial<FeedbackFormState>) => void;
  /** Non-null once a submission succeeded — swaps the form for the confirmation card. */
  ticket: FeedbackTicket | null;
  onReset: () => void;
  isAuthed: boolean;
  isSubmitting: boolean;
  /** True after a failed attempt — button reads "Retry Submission" (spec §3.4). */
  lastFailed: boolean;
  onSubmit: () => void;
}

/**
 * Tab 0 — Submit Feedback Ticket (feedback spec §3). In-line form: category
 * dropdown sheet, severity segmented pills, description textarea with live
 * counter (10–2000 chars), attachment tiles (≤3 files, ≤5 MB), anonymous
 * switch (forced on for guests), conditional contact email, and the primary
 * submit CTA. On success the form swaps in-place for the confirmation card
 * with the auto-generated ticket ID (spec §3.3).
 */
export function SubmitTicketTab({
  form,
  onChange,
  ticket,
  onReset,
  isAuthed,
  isSubmitting,
  lastFailed,
  onSubmit,
}: SubmitTicketTabProps) {
  const colors = useColors();
  const toast = useToast();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const needsEmail = !isAuthed || form.anonymous;
  const descOk = form.description.trim().length >= MIN_DESCRIPTION;
  const emailOk = !needsEmail || EMAIL_RE.test(form.contactEmail.trim());
  const canSubmit = descOk && emailOk && !isSubmitting;

  if (ticket) {
    return (
      <ConfirmationCard
        ticket={ticket}
        onReset={onReset}
        onCopy={() => {
          void Clipboard.setStringAsync(`#${ticket.id}`).catch(() => {});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.show('Ticket ID copied');
        }}
      />
    );
  }

  const pickAttachments = async () => {
    const room = MAX_ATTACHMENTS - form.attachments.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked: FeedbackAttachment[] = [];
    for (const asset of result.assets) {
      // fileSize is undefined on some Android builds — accept then (mock; the
      // real upload path will reject server-side).
      if (asset.fileSize !== undefined && asset.fileSize > MAX_ATTACHMENT_BYTES) {
        setUploadError('File exceeds 5MB limit.');
        continue;
      }
      picked.push({
        uri: asset.uri,
        name: asset.fileName ?? `attachment-${Date.now().toString(36)}.jpg`,
        size: asset.fileSize ?? 0,
        mime: asset.mimeType ?? 'image/jpeg',
      });
    }
    if (picked.length > 0) {
      setUploadError(null);
      onChange({ attachments: [...form.attachments, ...picked].slice(0, MAX_ATTACHMENTS) });
    }
  };

  const removeAttachment = (uri: string) => {
    onChange({ attachments: form.attachments.filter((a) => a.uri !== uri) });
  };

  return (
    <>
      <View style={styles.tab}>
        <SectionHeader
          title="Feedback & Bug Reporting"
          subtitle="Report bugs, suggest features, or reach out."
        />

      {/* Category */}
      <View style={styles.categoryRow}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text>
        <Pressable
          onPress={() => setCategoryOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Category: ${CATEGORY_LABEL[form.category]}`}
          hitSlop={4}
          style={({ pressed }) => [
            styles.categoryTrigger,
            { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.categoryLabel, { color: colors.text }]}>
            {CATEGORY_LABEL[form.category]}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Severity */}
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Severity Level *</Text>
      <View style={styles.severityRow}>
        {SEVERITY_OPTIONS.map((option) => {
          const active = option.value === form.severity;
          const tint = SEVERITY_COLORS[option.value];
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                Haptics.selectionAsync();
                onChange({ severity: option.value });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Severity ${option.label}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.severityPill,
                {
                  backgroundColor: active ? tint.bg : 'transparent',
                  borderColor: active ? 'transparent' : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.severityLabel,
                  {
                    color: active ? tint.text : colors.text,
                    fontFamily: active ? FONTS.semibold : FONTS.body,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Description */}
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Description *</Text>
      <View
        style={[
          styles.textareaWrap,
          {
            borderColor: attempted && !descOk ? colors.danger : textareaFocused ? colors.borderActive : colors.border,
            borderWidth: textareaFocused ? 2 : 1,
          },
        ]}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />
        <TextInput
          value={form.description}
          onChangeText={(t) => onChange({ description: t })}
          placeholder="Describe what happened in detail..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_DESCRIPTION}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          accessibilityLabel="Description, minimum 10 characters"
          style={[styles.textarea, { color: colors.text }]}
        />
      </View>
      <View style={styles.counterRow}>
        {attempted && !descOk ? (
          <Text style={[styles.hint, { color: colors.danger }]}>
            Minimum {MIN_DESCRIPTION} characters.
          </Text>
        ) : (
          <Text />
        )}
        <Text
          style={[
            styles.counter,
            {
              color:
                form.description.length >= MAX_DESCRIPTION ? colors.danger : colors.textMuted,
            },
          ]}
        >
          {form.description.length}/{MAX_DESCRIPTION}
        </Text>
      </View>

      {/* Attachments */}
      <Text style={[styles.fieldLabel, { color: colors.text }]}>
        Attachments (max 5MB each, up to 3 files)
      </Text>
      <View style={styles.attachRow}>
        {form.attachments.map((attachment) => (
          <View key={attachment.uri} style={styles.thumbWrap}>
            <Image source={{ uri: attachment.uri }} style={styles.thumb} contentFit="cover" />
            <Text style={[styles.thumbSize, { color: colors.textMuted }]}>
              {formatBytes(attachment.size)}
            </Text>
            <Pressable
              onPress={() => removeAttachment(attachment.uri)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${attachment.name}`}
              hitSlop={6}
              style={[styles.thumbRemove, { backgroundColor: colors.background }]}
            >
              <Ionicons name="close" size={12} color={colors.text} />
            </Pressable>
          </View>
        ))}
        {form.attachments.length < MAX_ATTACHMENTS ? (
          <Pressable
            onPress={pickAttachments}
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
            style={({ pressed }) => [
              styles.addTile,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="add" size={28} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      {uploadError ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{uploadError}</Text>
      ) : null}

      {/* Anonymous */}
      <Pressable
        onPress={() => {
          if (isAuthed) {
            Haptics.selectionAsync();
            onChange({ anonymous: !form.anonymous });
          }
        }}
        disabled={!isAuthed}
        accessibilityRole="switch"
        accessibilityLabel="Submit anonymously"
        accessibilityState={{ checked: form.anonymous || !isAuthed, disabled: !isAuthed }}
        style={styles.anonymousRow}
      >
        <View style={styles.anonymousTextCol}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Anonymous Submission</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {isAuthed
              ? form.anonymous
                ? 'Your profile is hidden from the ticket.'
                : 'Turn on to hide your profile.'
              : 'Required for guest submissions.'}
          </Text>
        </View>
        <View
          style={[
            styles.switchTrack,
            {
              backgroundColor: form.anonymous || !isAuthed ? colors.accent : colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.switchThumb,
              {
                backgroundColor: colors.surfaceSolid,
                transform: [{ translateX: form.anonymous || !isAuthed ? 20 : 0 }],
              },
            ]}
          />
        </View>
      </Pressable>

      {/* Contact email */}
      {needsEmail ? (
        <GlassInput
          label={isAuthed ? 'Contact Email' : 'Contact Email (Required for Guests)'}
          value={form.contactEmail}
          onChangeText={(t) => onChange({ contactEmail: t })}
          placeholder="student@goa.bits-pilani.ac.in"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          error={attempted && !emailOk ? 'Enter a valid email address.' : null}
          accessibilityLabel="Contact email"
        />
      ) : null}

      <PillButton
        label={lastFailed ? 'Retry Submission' : 'Submit Ticket'}
        onPress={() => {
          setAttempted(true);
          if (canSubmit) onSubmit();
        }}
        loading={isSubmitting}
        disabled={!canSubmit}
        accessibilityLabel="Submit ticket"
        style={styles.submit}
      />
      </View>

      <BottomSheet
        visible={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Select a category"
      >
        {CATEGORY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              onChange({ category: option.value });
              setCategoryOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: option.value === form.category }}
            style={({ pressed }) => [
              styles.sheetOption,
              { borderColor: option.value === form.category ? colors.borderActive : colors.border },
              pressed && styles.sheetOptionPressed,
            ]}
          >
            <Ionicons
              name={option.value === form.category ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={option.value === form.category ? colors.accent : colors.textMuted}
            />
            <Text
              style={[
                styles.sheetOptionLabel,
                {
                  color: option.value === form.category ? colors.text : colors.textMuted,
                  fontFamily: option.value === form.category ? FONTS.semibold : FONTS.body,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>
    </>
  );
}

/** In-line confirmation view (spec §3.3) — checkmark emblem, mono ticket ID, copy + reset. */
function ConfirmationCard({
  ticket,
  onReset,
  onCopy,
}: {
  ticket: FeedbackTicket;
  onReset: () => void;
  onCopy: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.confirmRoot}>
      <GlassCard accessibilityLabel="Ticket submitted">
        <View style={styles.confirmIconWrap}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        </View>
        <Text style={[styles.confirmTitle, { color: colors.text }]}>Ticket Submitted</Text>
        <Text style={[styles.confirmBody, { color: colors.textMuted }]}>
          Your ticket is in. We will reply by email — track it as{' '}
          <Text style={[styles.ticketId, { color: colors.text }]}>{`#${ticket.id}`}</Text>.
        </Text>
        <Pressable
          onPress={onCopy}
          accessibilityRole="button"
          accessibilityLabel={`Copy ticket ID ${ticket.id}`}
          style={({ pressed }) => [
            styles.copyRow,
            { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.ticketId, { color: colors.text }]}>{`#${ticket.id}`}</Text>
          <Ionicons name="copy-outline" size={16} color={colors.accent} />
        </Pressable>
        <PillButton
          variant="ghost"
          label="Submit Another Ticket"
          onPress={onReset}
          accessibilityLabel="Submit another ticket"
          style={styles.submit}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  fieldLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    lineHeight: 16,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  categoryLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  severityPill: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  textareaWrap: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  textarea: {
    minHeight: 96,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  counter: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
  },
  attachRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  addTile: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumb: {
    width: 72,
    height: 72,
  },
  thumbSize: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    fontFamily: FONTS.body,
    fontSize: 10,
    backgroundColor: 'rgba(6, 13, 14, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  anonymousTextCol: {
    flex: 1,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  submit: {
    marginTop: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sheetOptionPressed: {
    opacity: 0.85,
  },
  sheetOptionLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmRoot: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  confirmIconWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  ticketId: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 16,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
  },
});

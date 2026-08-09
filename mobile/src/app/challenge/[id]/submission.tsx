import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthLocked } from '@/components/AuthLocked';
import { BottomSheet } from '@/components/BottomSheet';
import { CountdownTimer } from '@/components/challenges/CountdownTimer';
import { DifficultyPill } from '@/components/challenges/Pills';
import { ProofUploadGrid } from '@/components/challenges/ProofUploadGrid';
import { StackNavBar } from '@/components/challenges/StackNavBar';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import type { ProofItem, SubmissionStatus } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import {
  useChallengeDetail,
  useChallengeSubmission,
  useSubmitProof,
} from '@/hooks/use-challenges';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const NOTES_LIMIT = 500;

/**
 * Challenge submission (points spec §8): proof grid (camera/gallery/link),
 * optional notes, deadline countdown, submit with per-state labels. Only
 * reachable after accepting. Withdrawal is not supported (§8.5).
 */
export default function SubmissionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useAuthStore((s) => s.status);
  const authed = status === 'authenticated';

  const challengeQuery = useChallengeDetail(id, { enabled: authed });
  const submissionQuery = useChallengeSubmission(id, { enabled: authed });
  const submit = useSubmitProof(id);

  const [proofItems, setProofItems] = useState<ProofItem[]>([]);
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const idRef = useRef(0);

  // Seed local editing state from the server, but never clobber in-flight
  // edits — only re-sync when the submission status actually changes.
  const lastStatus = useRef<SubmissionStatus | null>(null);
  useEffect(() => {
    const data = submissionQuery.data;
    if (data && data.status !== lastStatus.current) {
      lastStatus.current = data.status;
      setProofItems(data.proofItems);
      setNotes(data.notes);
    }
  }, [submissionQuery.data]);

  if (status === 'unknown' || status === 'loading') {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <StackNavBar title="Submission" onBack={() => router.back()} />
        <View style={styles.body}>
          <SkeletonBlock height={20} radius={6} />
          <SkeletonBlock width="60%" height={14} radius={4} />
          <SkeletonBlock height={96} radius={16} />
          <SkeletonBlock height={96} radius={16} />
        </View>
      </View>
    );
  }

  if (!authed) {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <StackNavBar title="Submission" onBack={() => router.back()} />
        <AuthLocked subject="your submission" />
      </View>
    );
  }

  const challenge = challengeQuery.data;
  const submission = submissionQuery.data;
  const submissionStatus = submission?.status ?? 'in_progress';
  const readOnly = submissionStatus === 'approved';

  const addAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const size = asset.fileSize ?? 0;
    const isVideo = asset.type === 'video';
    const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (size > limit) {
      toast.show(`File too large. Max ${isVideo ? '50 MB' : '10 MB'}.`);
      return;
    }
    const item: ProofItem = {
      id: `p${++idRef.current}`,
      type: isVideo ? 'video' : 'image',
      uri: asset.uri,
    };
    setProofItems((prev) => [...prev, item]);
  };

  const onCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
    });
    if (!result.canceled) addAsset(result.assets[0]);
  };

  const onGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
    });
    if (!result.canceled) result.assets.forEach(addAsset);
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//.test(url)) {
      toast.show('Please enter a valid URL starting with http');
      return;
    }
    setProofItems((prev) => [...prev, { id: `p${++idRef.current}`, type: 'link', uri: url }]);
    setLinkUrl('');
    setLinkOpen(false);
  };

  const confirmSubmit = () => {
    if (proofItems.length === 0) return;
    Alert.alert(
      'Submit proof',
      `Submit proof for ${challenge?.title ?? 'this challenge'}? You can update your submission until an admin reviews it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => {
            submit.mutate(
              { proofItems, notes: notes.trim() },
              {
                onSuccess: () => toast.show('Submission sent!'),
                onError: (err) =>
                  toast.show(err instanceof Error ? err.message : 'Could not submit proof'),
              },
            );
          },
        },
      ],
    );
  };

  const submitLabel =
    submissionStatus === 'rejected'
      ? 'Resubmit'
      : submissionStatus === 'under_review'
        ? 'Update Submission'
        : 'Submit for Review';

  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <StackNavBar title="Submission" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {challengeQuery.isPending || submissionQuery.isPending ? (
          <SubmissionSkeleton />
        ) : (
          <>
            {/* Header: challenge + status + deadline */}
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <Text style={[styles.challengeName, { color: colors.text }]} numberOfLines={2}>
                  {challenge?.title ?? 'Challenge'}
                </Text>
                {challenge ? <DifficultyPill difficulty={challenge.difficulty} /> : null}
              </View>
              <View style={styles.statusRow}>
                <StatusChip status={submissionStatus} />
                {submissionStatus === 'in_progress' && (
                  <CountdownTimer deadline={challenge?.deadline ?? null} />
                )}
              </View>
              <Text style={[styles.deadline, { color: colors.textMuted }]}>
                Deadline: {challenge?.deadline ? fmtDate(challenge.deadline) : 'No deadline'}
              </Text>
            </View>

            {submissionStatus === 'approved' && (
              <View style={[styles.banner, { borderColor: colors.success }]}>
                <Text style={[styles.bannerText, { color: colors.success }]}>
                  Approved — +{submission?.pointsAwarded ?? 0} pts awarded
                  {submission?.reviewedAt ? ` on ${fmtDate(submission.reviewedAt)}` : ''}
                </Text>
              </View>
            )}
            {submissionStatus === 'rejected' && (
              <View style={[styles.banner, { borderColor: colors.danger }]}>
                <Text style={[styles.bannerText, { color: colors.danger }]}>
                  Submission rejected
                  {submission?.adminNote ? ` — ${submission.adminNote}` : ''}
                </Text>
              </View>
            )}

            {/* Proof */}
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Proof / Evidence</Text>
            <ProofUploadGrid
              items={proofItems}
              onChange={setProofItems}
              readOnly={readOnly}
              onAdd={() => setPickerOpen(true)}
            />
            {!readOnly && (
              <View style={styles.uploadRow}>
                <UploadButton icon="camera-outline" label="Camera" onPress={onCamera} />
                <UploadButton icon="images-outline" label="Gallery" onPress={onGallery} />
                <UploadButton icon="link-outline" label="Link" onPress={() => setLinkOpen(true)} />
              </View>
            )}

            {/* Notes */}
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Notes (optional)</Text>
            {readOnly ? (
              <View style={[styles.notesReadonly, { borderColor: colors.border }]}>
                <Text style={[styles.notesText, { color: colors.text }]}>
                  {notes || 'No notes provided.'}
                </Text>
              </View>
            ) : (
              <>
                <GlassInput
                  label="Notes"
                  value={notes}
                  onChangeText={(t) => setNotes(t.slice(0, NOTES_LIMIT))}
                  placeholder="Add context, links, or anything that helps the admin review your proof…"
                  multiline
                  accessibilityLabel="Submission notes"
                />
                <Text style={[styles.counter, { color: colors.textMuted }]}>
                  {notes.length}/{NOTES_LIMIT}
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Fixed bottom submit (hidden for approved submissions) */}
      {!readOnly && (
        <View style={[styles.actionArea, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <PillButton
            variant="primary"
            label={submitLabel}
            onPress={confirmSubmit}
            loading={submit.isPending}
            disabled={proofItems.length === 0 || submit.isPending}
            accessibilityLabel={submitLabel}
          />
        </View>
      )}

      {/* Upload picker sheet */}
      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add proof">
        <View style={styles.pickerBody}>
          <PickerRow icon="camera-outline" label="Camera" onPress={onCamera} />
          <PickerRow icon="images-outline" label="Gallery" onPress={onGallery} />
          <PickerRow icon="link-outline" label="Link" onPress={() => { setPickerOpen(false); setLinkOpen(true); }} />
        </View>
      </BottomSheet>

      {/* Link input sheet */}
      <BottomSheet visible={linkOpen} onClose={() => setLinkOpen(false)} title="Add link">
        <View style={styles.pickerBody}>
          <GlassInput
            label="URL"
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://github.com/…"
            autoCapitalize="none"
            accessibilityLabel="Proof link URL"
          />
          <PillButton variant="primary" label="Add link" onPress={addLink} />
        </View>
      </BottomSheet>
    </View>
  );
}

function StatusChip({ status }: { status: SubmissionStatus }) {
  const colors = useColors();
  const label =
    status === 'in_progress' ? 'In Progress' : status === 'under_review' ? 'Under Review' : status === 'approved' ? 'Approved' : 'Rejected';
  const color =
    status === 'in_progress' ? colors.accent : status === 'under_review' ? colors.info : status === 'approved' ? colors.success : colors.danger;
  return (
    <View style={[styles.statusChip, { backgroundColor: colors.surfaceMuted, borderColor: color }]}>
      <Text style={[styles.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

function UploadButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.uploadButton,
        { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={[styles.uploadButtonText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function PickerRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={[styles.pickerRowText, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function SubmissionSkeleton() {
  return (
    <View style={styles.body}>
      <SkeletonBlock height={20} radius={6} />
      <SkeletonBlock width="60%" height={14} radius={4} />
      <SkeletonBlock height={14} radius={4} />
      <SkeletonBlock height={88} radius={16} />
      <View style={styles.gridSkeleton}>
        <SkeletonBlock width="31%" height={96} radius={12} />
        <SkeletonBlock width="31%" height={96} radius={12} />
        <SkeletonBlock width="31%" height={96} radius={12} />
      </View>
      <SkeletonBlock height={96} radius={16} />
    </View>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  body: {
    padding: 16,
    gap: 16,
  },
  headerCard: {
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  challengeName: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  deadline: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  bannerText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  sectionHeading: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  counter: {
    fontFamily: FONTS.body,
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: -10,
  },
  notesReadonly: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 64,
  },
  notesText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
  },
  actionArea: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pickerBody: {
    gap: 12,
    paddingBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  pickerRowText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  gridSkeleton: {
    flexDirection: 'row',
    gap: 10,
  },
});

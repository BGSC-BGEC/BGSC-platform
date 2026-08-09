import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { FeedbackTabRail } from '@/components/feedback/FeedbackTabRail';
import { DirectoryTab } from '@/components/feedback/DirectoryTab';
import { FaqTab } from '@/components/feedback/FaqTab';
import { SubmitTicketTab } from '@/components/feedback/SubmitTicketTab';
import {
  initialFeedbackForm,
  type FeedbackFormState,
  type FeedbackTabKey,
} from '@/components/feedback/types';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import type { FeedbackTicket } from '@/core/repositories/FeedbackRepository';
import { useColors } from '@/hooks/use-colors';
import {
  useCoordinators,
  useFaqs,
  useLegacyAdmins,
  useSubmitFeedback,
} from '@/hooks/use-feedback';
import { useRequireAuth } from '@/hooks/use-require-auth';

/**
 * Feedback & Contact (master §9 / feedback-contact-page.md §2).
 *
 * Three paged surfaces behind a sticky rail: Submit Ticket → FAQ → Directory.
 * The ticket form state is lifted here so FAQ "I still have a question" and
 * Directory "Report issue" can pre-fill the description and switch tabs.
 *
 * Guest gating: submitting a ticket is a write → useRequireAuth toast + /login
 * with returnTo (master §0.6). Guest submits are forced-anonymous by the form.
 */
export default function FeedbackScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const requireAuth = useRequireAuth();

  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const isAuthed = status === 'authenticated' && user != null;

  const [tab, setTab] = useState<FeedbackTabKey>(0);
  const pagerRef = useRef<ScrollView | null>(null);
  const [form, setForm] = useState<FeedbackFormState>(initialFeedbackForm);
  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [lastFailed, setLastFailed] = useState(false);

  const faqs = useFaqs();
  const coordinators = useCoordinators();
  const legacy = useLegacyAdmins();
  const submit = useSubmitFeedback();

  const selectTab = (index: FeedbackTabKey) => {
    Haptics.selectionAsync();
    setTab(index);
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const onMomentumEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width) as FeedbackTabKey;
    if (index !== tab) setTab(index);
  };

  const switchToTicket = useCallback((prefill: string) => {
    setForm((f) => ({ ...f, description: prefill }));
    setTab(0);
    pagerRef.current?.scrollTo({ x: 0, animated: true });
  }, [pagerRef]);

  const reportIssue = useCallback((coordinatorName: string) => {
    setForm((f) => ({
      ...f,
      description: `Issue with ${coordinatorName}: `,
      category: 'complaint',
    }));
    setTab(0);
    pagerRef.current?.scrollTo({ x: 0, animated: true });
  }, [pagerRef]);

  const resetForm = useCallback(() => {
    setForm(initialFeedbackForm);
    setTicket(null);
    setLastFailed(false);
  }, []);

  const onSubmit = useCallback(() => {
    if (!requireAuth('Log in to submit a ticket.')) return;
    submit.mutate(
      {
        category: form.category,
        severity: form.severity,
        description: form.description,
        attachments: form.attachments,
        anonymous: form.anonymous || !isAuthed,
        contactEmail: !isAuthed || form.anonymous ? form.contactEmail : undefined,
        userId: isAuthed ? user?.id : undefined,
      },
      {
        onSuccess: (t) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTicket(t);
          setLastFailed(false);
          toast.show("Ticket submitted — we'll get back to you soon.");
        },
        onError: (err) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setLastFailed(true);
          toast.show(err instanceof Error ? err.message : 'Could not submit your ticket.');
        },
      },
    );
  }, [requireAuth, submit, form, isAuthed, user, toast]);

  const patchForm = useCallback((patch: Partial<FeedbackFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.railWrap}>
          <FeedbackTabRail active={tab} onChange={selectTab} />
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.flex}
        >
          <View style={{ width }}>
            <SubmitTicketTab
              key={ticket ? 'done' : 'form'} // remount resets local UI on success (compiler-safe)
              form={form}
              onChange={patchForm}
              ticket={ticket}
              onReset={resetForm}
              isAuthed={isAuthed}
              isSubmitting={submit.isPending}
              lastFailed={lastFailed}
              onSubmit={onSubmit}
            />
          </View>
          <View style={{ width }}>
            <FaqTab
              sections={faqs.data}
              isLoading={faqs.isLoading}
              isError={faqs.isError}
              onRetry={() => void faqs.refetch()}
              onSwitchToTicket={switchToTicket}
            />
          </View>
          <View style={{ width }}>
            <DirectoryTab
              coordinators={coordinators.data}
              isLoading={coordinators.isLoading}
              isError={coordinators.isError}
              legacy={legacy.data}
              onRetry={() => {
                void coordinators.refetch();
                void legacy.refetch();
              }}
              onReportIssue={reportIssue}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  railWrap: {
    paddingTop: 12,
    paddingBottom: 4,
  },
});

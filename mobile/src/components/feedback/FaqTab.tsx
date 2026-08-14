import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/feedback/SectionHeader';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import type { FaqSection } from '@/core/repositories/FeedbackRepository';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface FaqTabProps {
  sections: FaqSection[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Switch to Tab 0 with the search query pre-filled as description (spec §4.4). */
  onSwitchToTicket: (prefill: string) => void;
}

/**
 * Tab 1 — FAQ knowledge base (feedback spec §4). Search filters questions and
 * answers in real time; matching categories/questions auto-expand. Outside a
 * search, category and question expansion are mutually exclusive. Loading,
 * empty-search and error states follow §4.4.
 */
export function FaqTab({ sections, isLoading, isError, onRetry, onSwitchToTicket }: FaqTabProps) {
  const [query, setQuery] = useState('');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!sections) return [];
    if (!q) return sections.map((section) => ({ section, faqs: section.faqs }));
    return sections
      .map((section) => ({
        section,
        faqs: section.faqs.filter(
          (faq) => faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.faqs.length > 0);
  }, [sections, q]);

  const header = (
    <SectionHeader
      title="Frequently Asked Questions"
      subtitle="Search and explore answers across platform topics."
    />
  );

  if (isLoading) {
    return (
      <View style={styles.tab}>
        {header}
        <SkeletonBlock height={48} radius={24} style={styles.searchSkeleton} />
        {[0, 1, 2].map((i) => (
          <GlassCard key={i} accessibilityLabel="Loading FAQ" style={styles.skeletonCard}>
            <SkeletonBlock width="60%" height={16} radius={4} style={styles.cardLine} />
            <SkeletonBlock width="90%" height={14} radius={4} style={styles.cardLine} />
            <SkeletonBlock width="45%" height={14} radius={4} />
          </GlassCard>
        ))}
      </View>
    );
  }

  if (isError || !sections) {
    return (
      <View style={styles.tab}>
        {header}
        <StateCard message="Unable to load FAQs." action="Retry" onAction={onRetry} />
      </View>
    );
  }

  return (
    <View style={styles.tab}>
      {header}
      <SearchBar query={query} onChange={(next) => {
        setQuery(next);
        setOpenCategory(null);
        setOpenQuestion(null);
      }} />

      {groups.length === 0 ? (
        <StateCard
          message="No matching FAQs found — try submitting a ticket."
          action="Submit Ticket"
          onAction={() => onSwitchToTicket(query)}
        />
      ) : (
        <View style={styles.accordionStack}>
          {groups.map(({ section, faqs }) => {
            const categoryOpen = q.length > 0 || openCategory === section.id;
            return (
              <AccordionCard
                key={section.id}
                title={section.title}
                count={faqs.length}
                open={categoryOpen}
                onToggle={() => {
                  if (q.length > 0) return;
                  setOpenCategory((current) => current === section.id ? null : section.id);
                  setOpenQuestion(null);
                }}
              >
                {faqs.map((faq) => (
                  <QuestionCard
                    key={faq.id}
                    question={faq.question}
                    answer={faq.answer}
                    highlighted={q.length > 0}
                    open={q.length > 0 || openQuestion === faq.id}
                    onToggle={() => {
                      if (q.length > 0) return;
                      setOpenQuestion((current) => current === faq.id ? null : faq.id);
                    }}
                  />
                ))}
              </AccordionCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SearchBar({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.searchWrap, { borderColor: focused ? colors.borderActive : colors.border }]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="Search frequently asked questions..."
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Search frequently asked questions"
        style={[styles.searchInput, { color: colors.text }]}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={() => onChange('')}
          accessibilityRole="button"
          accessibilityLabel="Clear FAQ search"
          hitSlop={8}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function AccordionCard({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <GlassCard accessibilityLabel={`${title}, ${count} FAQs`} style={styles.categoryCard}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded: open }}
        style={styles.accordionHeader}
      >
        <View style={styles.accordionTitleCol}>
          <Text style={[styles.categoryTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.count, { color: colors.textMuted }]}>{count} FAQs</Text>
        </View>
        <Ionicons name={open ? 'remove' : 'add'} size={20} color={colors.accent} />
      </Pressable>
      {open ? <View style={[styles.questionStack, { borderTopColor: colors.border }]}>{children}</View> : null}
    </GlassCard>
  );
}

function QuestionCard({
  question,
  answer,
  highlighted,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  highlighted: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.questionCard, { borderColor: colors.border, backgroundColor: highlighted ? colors.accentMuted : colors.surfaceMuted }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} question: ${question}`}
        accessibilityState={{ expanded: open }}
        style={styles.questionHeader}
      >
        <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={16} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <Text style={[styles.answer, { color: colors.textMuted, borderTopColor: colors.border }]}>
          {answer}
        </Text>
      ) : null}
    </View>
  );
}

function StateCard({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  const colors = useColors();
  return (
    <GlassCard accessibilityLabel={message}>
      <Text style={[styles.stateMessage, { color: colors.text }]}>{message}</Text>
      <PillButton variant="ghost" label={action} onPress={onAction} style={styles.stateAction} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  tab: { paddingHorizontal: 16, paddingBottom: 40 },
  searchWrap: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 14, paddingHorizontal: 10, paddingVertical: 12 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  accordionStack: { gap: 10 },
  categoryCard: { borderRadius: 30, padding: 12 },
  accordionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitleCol: { flex: 1 },
  categoryTitle: { fontFamily: FONTS.semibold, fontSize: 16, lineHeight: 22 },
  count: { fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },
  questionStack: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  questionCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  questionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  question: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, lineHeight: 18 },
  answer: { borderTopWidth: 1, fontFamily: FONTS.body, fontSize: 13, lineHeight: 20, padding: 12 },
  stateMessage: { fontFamily: FONTS.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  stateAction: { marginTop: 14 },
  searchSkeleton: { marginBottom: 16 },
  skeletonCard: { marginBottom: 10 },
  cardLine: { marginBottom: 8 },
});

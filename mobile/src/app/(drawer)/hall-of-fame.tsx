import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { HallOfFameRepository } from '@/core/repositories/HallOfFameRepository';
import type { HallOfFameEventWinner, HallOfFameSponsorChampion } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

type TypeFilter = 'all' | 'events' | 'sponsors';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function shortId(userId: string): string {
  return 'Player #' + userId.slice(-6).toUpperCase();
}

function extractYear(iso: string): number {
  return new Date(iso).getFullYear();
}

export default function HallOfFameScreen() {
  const colors = useColors();

  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [expanded, setExpanded] = useState({
    league: true,
    highlight: true,
    challenges: true,
    sponsors: true,
  });

  const {
    data: eventWinners = [],
    isLoading: ewLoading,
    error: ewError,
    refetch: refetchEW,
  } = useQuery({
    queryKey: ['hall-of-fame', 'event-winners'],
    queryFn: HallOfFameRepository.getEventWinners,
  });

  const {
    data: sponsorChampions = [],
    isLoading: scLoading,
    error: scError,
    refetch: refetchSC,
  } = useQuery({
    queryKey: ['hall-of-fame', 'sponsor-champions'],
    queryFn: HallOfFameRepository.getSponsorChampions,
  });

  const years = [...new Set(eventWinners.map((w) => extractYear(w.eventDate)))].sort((a, b) => b - a);
  const filteredWinners = yearFilter === null
    ? eventWinners
    : eventWinners.filter((w) => extractYear(w.eventDate) === yearFilter);

  const showEvents = typeFilter === 'all' || typeFilter === 'events';
  const showSponsors = typeFilter === 'all' || typeFilter === 'sponsors';

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => { refetchEW(); refetchSC(); }}
          tintColor={colors.accent}
        />
      }
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[s.headerTitle, { color: colors.text }]}>🏆 Hall of Fame</Text>
        <Text style={[s.headerSub, { color: colors.textMuted }]}>Celebrating our champions</Text>
      </View>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        {/* Year */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <Pressable
            onPress={() => setYearFilter(null)}
            style={[
              s.filterChip,
              yearFilter === null
                ? { backgroundColor: colors.accent + '22', borderColor: colors.accent }
                : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <Text style={[s.filterChipText, { color: yearFilter === null ? colors.accent : colors.textMuted }]}>
              All Years
            </Text>
          </Pressable>
          {years.map((year) => {
            const isActive = yearFilter === year;
            return (
              <Pressable
                key={year}
                onPress={() => setYearFilter(isActive ? null : year)}
                style={[
                  s.filterChip,
                  isActive
                    ? { backgroundColor: colors.accent + '22', borderColor: colors.accent }
                    : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text style={[s.filterChipText, { color: isActive ? colors.accent : colors.textMuted }]}>
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Type */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterRow, { paddingTop: 0 }]}>
          {([
            { key: 'all', label: 'All' },
            { key: 'events', label: '🏅 Events' },
            { key: 'sponsors', label: '👑 Sponsors' },
          ] as { key: TypeFilter; label: string }[]).map(({ key, label }) => {
            const isActive = typeFilter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTypeFilter(isActive && key !== 'all' ? 'all' : key)}
                style={[
                  s.filterChip,
                  isActive
                    ? { backgroundColor: colors.accent + '22', borderColor: colors.accent }
                    : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text style={[s.filterChipText, { color: isActive ? colors.accent : colors.textMuted }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── League Winners ─────────────────────────────────────── */}
      {showEvents && (
        <Section
          title="🏆 League Winners"
          expanded={expanded.league}
          onToggle={() => toggle('league')}
          colors={colors}
        >
          {ewLoading ? (
            <HorizontalSkeletons colors={colors} />
          ) : ewError ? (
            <InlineError onRetry={refetchEW} colors={colors} />
          ) : filteredWinners.length === 0 ? (
            <EmptyText
              text={yearFilter ? 'No results match your filters' : 'No league winners recorded yet'}
              colors={colors}
            />
          ) : (
            <FlatList
              horizontal
              data={filteredWinners}
              keyExtractor={(item) => item.eventId}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={s.carousel}
              renderItem={({ item }) => <EventWinnerCard item={item} colors={colors} />}
            />
          )}
        </Section>
      )}

      {/* ── Highlight Event Winners — stub ─────────────────────── */}
      {showEvents && (
        <Section
          title="⭐ Highlight Event Winners"
          expanded={expanded.highlight}
          onToggle={() => toggle('highlight')}
          colors={colors}
        >
          <EmptyText text="No highlight event winners yet" colors={colors} />
        </Section>
      )}

      {/* ── Challenge Legends — stub (Phase 2) ─────────────────── */}
      <Section
        title="🔥 Challenge Legends"
        expanded={expanded.challenges}
        onToggle={() => toggle('challenges')}
        colors={colors}
      >
        <EmptyText text="No legends yet — will you be the first?" colors={colors} />
      </Section>

      {/* ── Sponsor Champions ──────────────────────────────────── */}
      {showSponsors && (
        <Section
          title="👑 Sponsor Champions"
          expanded={expanded.sponsors}
          onToggle={() => toggle('sponsors')}
          colors={colors}
        >
          {scLoading ? (
            <HorizontalSkeletons colors={colors} />
          ) : scError ? (
            <InlineError onRetry={refetchSC} colors={colors} />
          ) : sponsorChampions.length === 0 ? (
            <EmptyText text="No sponsor champions yet" colors={colors} />
          ) : (
            <FlatList
              horizontal
              data={sponsorChampions}
              keyExtractor={(item) => item.sponsorId}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={s.carousel}
              renderItem={({ item }) => <SponsorChampionCard item={item} colors={colors} />}
            />
          )}
        </Section>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  expanded,
  onToggle,
  children,
  colors,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[s.section, { borderBottomColor: colors.border }]}>
      <Pressable
        style={[s.sectionHeader, { backgroundColor: colors.surface }]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={[s.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[s.sectionChevron, { color: colors.textMuted }]}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function EventWinnerCard({ item, colors }: { item: HallOfFameEventWinner; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() =>
        Alert.alert(
          item.eventTitle,
          `Winner: ${shortId(item.userId)}\nScore: ${item.score}\nDate: ${fmtDate(item.eventDate)}`,
        )
      }
    >
      <Text style={s.cardIcon}>🏆</Text>
      <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {item.eventTitle}
      </Text>
      <Text style={[s.cardWinner, { color: colors.textMuted }]}>{shortId(item.userId)}</Text>
      <Text style={[s.cardScore, { color: colors.accent }]}>Score: {item.score}</Text>
      <Text style={[s.cardDate, { color: colors.textMuted }]}>{fmtDate(item.eventDate)}</Text>
      <Pressable
        onPress={() => Alert.alert('Share', 'Shareable card generation coming soon.')}
        style={s.shareBtn}
        hitSlop={8}
      >
        <Text style={[s.shareBtnText, { color: colors.accent }]}>Share ↗</Text>
      </Pressable>
    </Pressable>
  );
}

function SponsorChampionCard({ item, colors }: { item: HallOfFameSponsorChampion; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={s.cardIcon}>👑</Text>
      <View style={[s.rankBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
        <Text style={[s.rankBadgeText, { color: colors.accent }]}>#{item.rank}</Text>
      </View>
      <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={{ gap: 5, marginTop: 6 }}>
        {([
          { label: 'Total Fans', value: fmt(item.totalFans) },
          { label: 'Events Won', value: String(item.eventsWonCount) },
          { label: 'Affiliates', value: String(item.affiliatedUserCount) },
        ]).map((stat) => (
          <View key={stat.label} style={s.sponsorStatRow}>
            <Text style={[s.sponsorStatLabel, { color: colors.textMuted }]}>{stat.label}</Text>
            <Text style={[s.sponsorStatValue, { color: colors.text }]}>{stat.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Shared state components ──────────────────────────────────────────────────

function HorizontalSkeletons({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 8 }]}>
          <SkeletonBox width={32} height={32} borderRadius={16} />
          <SkeletonBox width="80%" height={16} />
          <SkeletonBox width="60%" height={13} />
          <SkeletonBox width="50%" height={13} />
        </View>
      ))}
    </View>
  );
}

function EmptyText({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={s.emptyBox}>
      <Text style={[s.emptyText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

function InlineError({ onRetry, colors }: { onRetry: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={s.emptyBox}>
      <Text style={[s.emptyText, { color: colors.textMuted }]}>Failed to load</Text>
      <Pressable onPress={onRetry}>
        <Text style={[s.retryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerSub: { fontSize: 14 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  section: { borderBottomWidth: StyleSheet.hairlineWidth },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionChevron: { fontSize: 16 },
  sectionBody: { paddingBottom: 8 },

  carousel: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },

  card: {
    width: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  cardWinner: { fontSize: 13 },
  cardScore: { fontSize: 13, fontWeight: '600' },
  cardDate: { fontSize: 12 },

  rankBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rankBadgeText: { fontSize: 12, fontWeight: '700' },

  sponsorStatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sponsorStatLabel: { fontSize: 12 },
  sponsorStatValue: { fontSize: 12, fontWeight: '600' },

  shareBtn: { alignSelf: 'flex-end', marginTop: 4 },
  shareBtnText: { fontSize: 12, fontWeight: '600' },

  emptyBox: { padding: 20, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  retryText: { fontSize: 13, fontWeight: '600' },
});

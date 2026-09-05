import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  EMPTY_FILTERS,
  FilterBar,
  type HallOfFameFilters,
} from '@/components/hall-of-fame/FilterBar';
import { SectionCard } from '@/components/hall-of-fame/SectionCard';
import {
  CardSkeletonRow,
  PageEmpty,
  PageError,
  SectionEmpty,
  SectionError,
} from '@/components/hall-of-fame/SectionStates';
import { SponsorChampionCard } from '@/components/hall-of-fame/SponsorChampionCard';
import { WinnerCard } from '@/components/hall-of-fame/WinnerCard';
import { WinnerDetailSheet } from '@/components/hall-of-fame/WinnerDetailSheet';
import { Screen } from '@/components/screen';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import type { HallOfFameEventWinner } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { useHallOfFameEventWinners, useHallOfFameSponsorChampions } from '@/hooks/use-hall-of-fame';

const NO_MATCHES = 'No results match your filters';

/**
 * Hall of Fame (master §9 / hall-of-fame.md) — public read, no guest gate.
 * Category sections (spec §5): League Winners + Sponsor Champions are wired
 * to the event-service endpoints; Highlight Event Winners + Challenge Legends
 * render their spec empty states until their data lands (Phase 2 TODOs).
 */
export default function HallOfFameScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const toast = useToast();

  const winners = useHallOfFameEventWinners();
  const champions = useHallOfFameSponsorChampions();

  const [filters, setFilters] = useState<HallOfFameFilters>(EMPTY_FILTERS);
  const [selectedWinner, setSelectedWinner] = useState<HallOfFameEventWinner | null>(null);

  const loading = winners.isPending || champions.isPending;
  const pageError = winners.isError && champions.isError;
  // M-30: data is undefined when a query errors, making length 0 which looks
  // like "empty". Only show the empty state when both queries have succeeded
  // and genuinely returned no data.
  const pageEmpty =
    !loading &&
    !pageError &&
    winners.isSuccess &&
    champions.isSuccess &&
    (winners.data?.length ?? 0) === 0 &&
    (champions.data?.length ?? 0) === 0;

  // Filter options derived from live data (spec §4: years/sponsors populated from data).
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const w of winners.data ?? []) set.add(new Date(w.eventDate).getFullYear().toString());
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [winners.data]);

  const sponsors = useMemo(
    () => [...new Set((champions.data ?? []).map((c) => c.name))],
    [champions.data],
  );

  const leagueWinners = useMemo(
    () =>
      (winners.data ?? []).filter(
        (w) => !filters.year || new Date(w.eventDate).getFullYear().toString() === filters.year,
      ),
    [winners.data, filters.year],
  );
  const championList = useMemo(
    () => (champions.data ?? []).filter((c) => !filters.sponsor || c.name === filters.sponsor),
    [champions.data, filters.sponsor],
  );

  // Type filter narrows to one section (spec §4: "Type: League → only league winners").
  const showLeague = !filters.type || filters.type === 'League';
  const showHighlight = !filters.type || filters.type === 'Highlight';
  const showChallenge = !filters.type || filters.type === 'Challenge';
  const showSponsor = !filters.type || filters.type === 'Sponsor';

  // Year/sponsor filters leave non-matching sections visible with inline text (§4).
  const leagueFiltered = filters.year !== null;
  const sponsorFiltered = filters.sponsor !== null;
  const noMatchHighlight = showHighlight && (leagueFiltered || sponsorFiltered);
  const noMatchChallenge = showChallenge && (leagueFiltered || sponsorFiltered);

  const onShare = () => {
    toast.show('Shareable winner cards arrive with Phase 2 media support.');
  };

  return (
    <Screen scroll={false} bottomInset={24}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={winners.isRefetching || champions.isRefetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['hall-of-fame'] })}
            tintColor={colors.textMuted}
          />
        }
      >
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="trophy-outline" size={22} color={colors.accent} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Hall of Fame
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Celebrating our champions
          </Text>
        </View>

        {loading ? (
          <FilterBarSkeleton />
        ) : pageError ? (
          <PageError onRetry={() => {
            void winners.refetch();
            void champions.refetch();
          }} />
        ) : pageEmpty ? (
          <PageEmpty />
        ) : (
          <>
            <FilterBar filters={filters} onChange={setFilters} years={years} sponsors={sponsors} />

            {showLeague ? (
              <SectionCard icon="trophy-outline" title="League Winners">
                {winners.isPending ? (
                  <CardSkeletonRow />
                ) : winners.isError ? (
                  <SectionError onRetry={() => winners.refetch()} />
                ) : leagueWinners.length === 0 ? (
                  <SectionEmpty message={leagueFiltered ? NO_MATCHES : 'No league winners recorded yet'} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                    {leagueWinners.map((winner) => (
                      <WinnerCard
                        key={winner.eventId}
                        winner={winner}
                        onPress={() => setSelectedWinner(winner)}
                        onShare={onShare}
                      />
                    ))}
                  </ScrollView>
                )}
              </SectionCard>
            ) : null}

            {showHighlight ? (
              <SectionCard icon="star-outline" title="Highlight Event Winners">
                <SectionEmpty message={noMatchHighlight ? NO_MATCHES : 'No highlight event winners yet'} />
              </SectionCard>
            ) : null}

            {showChallenge ? (
              <SectionCard icon="flame-outline" title="Challenge Legends">
                <SectionEmpty message={noMatchChallenge ? NO_MATCHES : 'No legends yet — will you be the first?'} />
              </SectionCard>
            ) : null}

            {showSponsor ? (
              <SectionCard icon="medal-outline" title="Sponsor Champions">
                {champions.isPending ? (
                  <CardSkeletonRow />
                ) : champions.isError ? (
                  <SectionError onRetry={() => champions.refetch()} />
                ) : championList.length === 0 ? (
                  <SectionEmpty message={sponsorFiltered ? NO_MATCHES : 'No sponsor champions yet'} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                    {championList.map((champion) => (
                      <SponsorChampionCard key={champion.sponsorId} champion={champion} />
                    ))}
                  </ScrollView>
                )}
                <Phase2Block label="MVP Contributors" note="Top individual fan-earners per sponsor" />
                <Phase2Block label="Sponsor Dynasty Timeline" note="Consecutive sponsor wins across semesters" />
              </SectionCard>
            ) : null}
          </>
        )}
      </ScrollView>

      <WinnerDetailSheet winner={selectedWinner} onClose={() => setSelectedWinner(null)} />
    </Screen>
  );
}

/** Inline Phase-2 placeholder for spec sub-sections without a backend source yet. */
function Phase2Block({ label, note }: { label: string; note: string }) {
  const colors = useColors();
  return (
    <View style={[styles.phase2, { borderColor: colors.border }]}>
      <Text style={[styles.phase2Label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.phase2Note, { color: colors.textMuted }]}>{note}</Text>
      <Text style={[styles.phase2Tag, { color: colors.accent }]}>Coming soon</Text>
    </View>
  );
}

/** Filter chips skeleton (spec §11). */
function FilterBarSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      {[1, 2, 3].map((i) => (
        <SkeletonBlock key={i} width={96} height={44} radius={20} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
  },
  carousel: {
    gap: 12,
    paddingRight: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  phase2: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
    gap: 2,
  },
  phase2Label: {
    fontFamily: FONTS.heading,
    fontSize: 17,
  },
  phase2Note: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  phase2Tag: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});

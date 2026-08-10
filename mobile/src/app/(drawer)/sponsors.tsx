import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import {
  NEWSLETTER_CATEGORIES,
  type NewsletterCategory,
  type PastSponsor,
  type SponsorPrize,
} from '@/core/repositories/SponsorRepository';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import type { HallOfFameSponsorChampion, SponsorStats } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import {
  useActiveSponsors,
  useChangeSponsor,
  useMyAffiliation,
  useNewsletterSubs,
  usePastSponsors,
  useSponsorPrizes,
  useUpdateNewsletterSubs,
} from '@/hooks/use-sponsors';

/**
 * L-12: `${color}22` hex alpha concatenation breaks for rgba() tokens.
 * Convert any color to a safe rgba background using CSS opacity instead.
 */
function hexAlpha(color: string, alpha: number): string {
  // If it's already rgba/hsl we can't safely append hex digits — use opacity wrapper.
  // For simple hex we can fall back to the opacity trick via a pseudo-element workaround.
  // Simplest portable approach: return the color and rely on opacity on the View.
  // Actually the cleanest solution is to just return a transparent version using the
  // RN `opacity` style on the container, but that affects children.
  // For hex colors we can parse and rebuild; for non-hex fall back to transparent.
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    const hex = color.length === 4
      ? color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // rgba/hsl/named — strip to transparent overlay via a known safe fallback.
  return 'transparent';
}

export default function SponsorsScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const toast = useToast();
  const status = useAuthStore((s) => s.status);
  const isAuthed = status === 'authenticated';

  const activeSponsors = useActiveSponsors();
  const affiliation = useMyAffiliation();
  const prizes = useSponsorPrizes();
  const newsletters = useNewsletterSubs();
  const pastSponsors = usePastSponsors();
  const changeSponsor = useChangeSponsor();
  const updateNewsletters = useUpdateNewsletterSubs();

  const [changeSheetVisible, setChangeSheetVisible] = useState(false);
  const [changeTarget, setChangeTarget] = useState<HallOfFameSponsorChampion | null>(null);

  const isRefetching =
    activeSponsors.isRefetching ||
    affiliation.isRefetching ||
    prizes.isRefetching ||
    pastSponsors.isRefetching;

  const onRefresh = () => qc.invalidateQueries({ queryKey: ['sponsors'] });

  const onToggleNewsletter = (cat: NewsletterCategory, current: NewsletterCategory[]) => {
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updateNewsletters.mutate(next, {
      onSuccess: () => toast.show(`${current.includes(cat) ? 'Unsubscribed from' : 'Subscribed to'} ${cat}.`),
      // H-32: onError rollback is handled in useUpdateNewsletterSubs (optimistic
      // update with ctx.prev revert). Surface a toast so the user knows it failed.
      onError: () => toast.show('Could not update newsletter preferences. Try again.'),
    });
  };

  const confirmChangeSponsor = () => {
    if (!changeTarget) return;
    changeSponsor.mutate(changeTarget.sponsorId, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Sponsor affiliation updated.');
        setChangeSheetVisible(false);
        setChangeTarget(null);
      },
      onError: () => toast.show('Could not update sponsor. Try again.'),
    });
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.textMuted} />
      }
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>SPONSORS</Text>

      {isAuthed && (
        <AffiliationSection
          affiliation={affiliation.data ?? null}
          loading={affiliation.isPending}
          onChangePress={() => setChangeSheetVisible(true)}
        />
      )}

      <ActiveSponsorsSection
        sponsors={activeSponsors.data ?? []}
        loading={activeSponsors.isPending}
        isError={activeSponsors.isError}
        onRetry={() => void activeSponsors.refetch()}
        onSelectSponsor={(s) => { setChangeTarget(s); setChangeSheetVisible(true); }}
      />

      <PrizesSection prizes={prizes.data ?? []} loading={prizes.isPending} />

      {isAuthed && (
        <NewsletterSection
          subs={newsletters.data ?? []}
          loading={newsletters.isPending}
          onToggle={(cat) => onToggleNewsletter(cat, newsletters.data ?? [])}
        />
      )}

      <ArchiveSection sponsors={pastSponsors.data ?? []} loading={pastSponsors.isPending} />

      <ChangeSponsorSheet
        visible={changeSheetVisible}
        sponsor={changeTarget}
        sponsors={activeSponsors.data ?? []}
        onClose={() => { setChangeSheetVisible(false); setChangeTarget(null); }}
        onSelectSponsor={setChangeTarget}
        onConfirm={confirmChangeSponsor}
        loading={changeSponsor.isPending}
      />
    </ScrollView>
  );
}

// ─── Affiliation ──────────────────────────────────────────────────────────────

function AffiliationSection({
  affiliation, loading, onChangePress,
}: { affiliation: SponsorStats | null; loading: boolean; onChangePress: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <SectionHeading title="Your Sponsor" />
      {loading ? (
        <GlassCard><SkeletonBlock width={120} height={16} radius={6} /><SkeletonBlock width="80%" height={13} radius={6} style={{ marginTop: 8 }} /><SkeletonBlock width="60%" height={13} radius={6} style={{ marginTop: 6 }} /></GlassCard>
      ) : affiliation ? (
        <GlassCard>
          <View style={styles.affiliationHeader}>
            <View style={[styles.sponsorBadge, { backgroundColor: colors.accentMuted }]}>
              <Ionicons name="medal-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sponsorName, { color: colors.text }]}>{affiliation.sponsorName}</Text>
              <Text style={[styles.sponsorMeta, { color: colors.textMuted }]}>Rank #{affiliation.rank} · {affiliation.totalAffiliates.toLocaleString()} affiliates</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.impactLabel, { color: colors.textMuted }]}>Your Impact</Text>
          <View style={styles.statsRow}>
            <StatChip icon="people-outline" value={affiliation.fansContributed.toLocaleString()} label="Fans" />
            <StatChip icon="trophy-outline" value={affiliation.eventsWon.toString()} label="Event Wins" />
            <StatChip icon="stats-chart-outline" value={`#${affiliation.rank}`} label="Rank" />
          </View>
          <PillButton label="Change Sponsor" variant="ghost" onPress={onChangePress} accessibilityLabel="Change sponsor" fullWidth={false} style={styles.changeBtn} />
        </GlassCard>
      ) : (
        <GlassCard>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>You have no active sponsor affiliation.</Text>
          <PillButton label="Choose a Sponsor" variant="primary" onPress={onChangePress} accessibilityLabel="Choose a sponsor" style={{ marginTop: 12 }} />
        </GlassCard>
      )}
    </View>
  );
}

function StatChip({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statChip, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.statChipValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Active Sponsors ─────────────────────────────────────────────────────────

function ActiveSponsorsSection({
  sponsors, loading, isError, onRetry, onSelectSponsor,
}: {
  sponsors: HallOfFameSponsorChampion[];
  loading: boolean; isError: boolean; onRetry: () => void;
  onSelectSponsor: (s: HallOfFameSponsorChampion) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <SectionHeading title="Active Sponsors" />
      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          <SkeletonBlock width={220} height={160} radius={16} />
          <SkeletonBlock width={220} height={160} radius={16} />
        </ScrollView>
      ) : isError ? (
        <GlassCard>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Could not load sponsors.</Text>
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </GlassCard>
      ) : sponsors.length === 0 ? (
        <GlassCard><Text style={[styles.emptyText, { color: colors.textMuted }]}>No active sponsors at this time.</Text></GlassCard>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {sponsors.map((s) => <SponsorCard key={s.sponsorId} sponsor={s} onPress={() => onSelectSponsor(s)} />)}
        </ScrollView>
      )}
    </View>
  );
}

function SponsorCard({ sponsor, onPress }: { sponsor: HallOfFameSponsorChampion; onPress: () => void }) {
  const colors = useColors();
  return (
    <GlassCard onPress={onPress} accessibilityLabel={`${sponsor.name}, rank ${sponsor.rank}`} style={styles.sponsorCard}>
      <View style={styles.sponsorCardTop}>
        <View style={[styles.sponsorLogoBox, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="business-outline" size={28} color={colors.textMuted} />
        </View>
        <View style={[styles.rankBadge, { backgroundColor: colors.accentMuted }]}>
          <Text style={[styles.rankBadgeText, { color: colors.accent }]}>#{sponsor.rank}</Text>
        </View>
      </View>
      <Text style={[styles.sponsorCardName, { color: colors.text }]} numberOfLines={1}>{sponsor.name}</Text>
      <View style={styles.sponsorStats}>
        <View style={styles.sponsorStatItem}>
          <Ionicons name="people-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.sponsorStatText, { color: colors.textMuted }]}>{sponsor.totalFans.toLocaleString()} fans</Text>
        </View>
        <View style={styles.sponsorStatItem}>
          <Ionicons name="trophy-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.sponsorStatText, { color: colors.textMuted }]}>{sponsor.eventsWonCount} wins</Text>
        </View>
        <View style={styles.sponsorStatItem}>
          <Ionicons name="person-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.sponsorStatText, { color: colors.textMuted }]}>{sponsor.affiliatedUserCount} users</Text>
        </View>
      </View>
    </GlassCard>
  );
}

// ─── Prizes ───────────────────────────────────────────────────────────────────

function PrizesSection({ prizes, loading }: { prizes: SponsorPrize[]; loading: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <SectionHeading title="Sponsor Prizes" />
      {loading ? (
        <View style={styles.stack}><SkeletonBlock height={100} radius={16} /><SkeletonBlock height={100} radius={16} /></View>
      ) : prizes.length === 0 ? (
        <GlassCard><Text style={[styles.emptyText, { color: colors.textMuted }]}>No prizes active currently.</Text></GlassCard>
      ) : (
        <View style={styles.stack}>
          {prizes.map((p) => <PrizeCard key={p.id} prize={p} />)}
        </View>
      )}
    </View>
  );
}

function PrizeCard({ prize }: { prize: SponsorPrize }) {
  const colors = useColors();
  const statusColor = prize.status === 'available' ? colors.success : prize.status === 'claimed' ? colors.danger : colors.textMuted;
  const statusLabel = prize.status.charAt(0).toUpperCase() + prize.status.slice(1);
  return (
    <GlassCard accessibilityLabel={prize.title}>
      <View style={styles.prizeHeader}>
        <Text style={[styles.prizeTitle, { color: colors.text }]} numberOfLines={1}>{prize.title}</Text>
        <View style={[styles.statusPill, { backgroundColor: hexAlpha(statusColor, 0.13) }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={[styles.prizeMeta, { color: colors.textMuted }]}>Sponsored by <Text style={{ color: colors.text }}>{prize.sponsorName}</Text></Text>
      <Text style={[styles.prizeMeta, { color: colors.textMuted }]}>Criteria: {prize.criteria}</Text>
      <Text style={[styles.prizeMeta, { color: colors.textMuted }]}>Leader: <Text style={{ color: colors.accent }}>@{prize.leader}</Text></Text>
    </GlassCard>
  );
}

// ─── Newsletters ─────────────────────────────────────────────────────────────

function NewsletterSection({
  subs, loading, onToggle,
}: { subs: NewsletterCategory[]; loading: boolean; onToggle: (cat: NewsletterCategory) => void }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <SectionHeading title="Manage Subscriptions" />
      <GlassCard>
        {loading ? (
          <View style={styles.stack}>
            {NEWSLETTER_CATEGORIES.map((c) => <SkeletonBlock key={c} height={44} radius={8} />)}
          </View>
        ) : (
          NEWSLETTER_CATEGORIES.map((cat, i) => (
            <View key={cat} style={[styles.newsletterRow, i > 0 && { borderTopWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.newsletterLabel, { color: colors.text }]}>{cat}</Text>
              <Switch
                value={subs.includes(cat)}
                onValueChange={() => onToggle(cat)}
                trackColor={{ false: colors.surfaceMuted, true: colors.accentMuted }}
                thumbColor={subs.includes(cat) ? colors.accent : colors.textMuted}
                accessibilityLabel={`Toggle ${cat} newsletter`}
              />
            </View>
          ))
        )}
      </GlassCard>
    </View>
  );
}

// ─── Archive ─────────────────────────────────────────────────────────────────

function ArchiveSection({ sponsors, loading }: { sponsors: PastSponsor[]; loading: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <SectionHeading title="Sponsor Archive" />
      {loading ? (
        <View style={styles.stack}><SkeletonBlock height={120} radius={16} /><SkeletonBlock height={120} radius={16} /></View>
      ) : sponsors.length === 0 ? (
        <GlassCard><Text style={[styles.emptyText, { color: colors.textMuted }]}>No past sponsors to display.</Text></GlassCard>
      ) : (
        <View style={styles.stack}>
          {sponsors.map((s) => <ArchiveCard key={s.id} sponsor={s} />)}
        </View>
      )}
    </View>
  );
}

function ArchiveCard({ sponsor }: { sponsor: PastSponsor }) {
  const colors = useColors();
  const platformIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    web: 'globe-outline', instagram: 'logo-instagram', twitter: 'logo-twitter', linkedin: 'logo-linkedin',
  };
  return (
    <GlassCard accessibilityLabel={`${sponsor.name} archive entry`}>
      <View style={styles.archiveHeader}>
        <View style={[styles.archiveBadge, { backgroundColor: sponsor.logoColor + '22' }]}>
          <Text style={[styles.archiveBadgeText, { color: sponsor.logoColor }]}>{sponsor.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.archiveName, { color: colors.text }]}>{sponsor.name}</Text>
          <Text style={[styles.archiveMeta, { color: colors.textMuted }]}>Tenure: {sponsor.tenure}</Text>
        </View>
      </View>
      {sponsor.linkedEvents.length > 0 ? (
        <Text style={[styles.archiveMeta, { color: colors.textMuted }]}>Events: {sponsor.linkedEvents.join(', ')}</Text>
      ) : null}
      <View style={styles.socialRow}>
        {sponsor.socialLinks.map((link) => (
          <Pressable
            key={link.platform}
            onPress={() => void WebBrowser.openBrowserAsync(link.url)}
            accessibilityRole="link"
            accessibilityLabel={`${sponsor.name} ${link.platform}`}
            hitSlop={8}
            style={[styles.socialBtn, { borderColor: colors.border }]}
          >
            <Ionicons name={platformIcon[link.platform] ?? 'link-outline'} size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );
}

// ─── Change Sponsor Sheet ────────────────────────────────────────────────────

function ChangeSponsorSheet({
  visible, sponsor, sponsors, onClose, onSelectSponsor, onConfirm, loading,
}: {
  visible: boolean;
  sponsor: HallOfFameSponsorChampion | null;
  sponsors: HallOfFameSponsorChampion[];
  onClose: () => void;
  onSelectSponsor: (s: HallOfFameSponsorChampion) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Change Sponsor">
      <Text style={[styles.sheetWarning, { color: colors.textMuted }]}>
        Selection is final for the current semester. You can only change once per semester.
      </Text>
      <View style={styles.stack}>
        {sponsors.map((s) => {
          const isSelected = s.sponsorId === sponsor?.sponsorId;
          return (
            <Pressable
              key={s.sponsorId}
              onPress={() => onSelectSponsor(s)}
              accessibilityRole="radio"
              accessibilityLabel={s.name}
              accessibilityState={{ checked: isSelected }}
              style={[styles.sponsorRadioRow, { borderColor: isSelected ? colors.accent : colors.border }, isSelected && { backgroundColor: colors.accentMuted }]}
            >
              <View style={[styles.radio, { borderColor: isSelected ? colors.accent : colors.border }, isSelected && { backgroundColor: colors.accent }]} />
              <Text style={[styles.sponsorRadioName, { color: colors.text, flex: 1 }]}>{s.name}</Text>
              <Text style={[styles.sponsorRadioMeta, { color: colors.textMuted }]}>{s.totalFans.toLocaleString()} fans</Text>
            </Pressable>
          );
        })}
      </View>
      <PillButton
        label="Confirm Change"
        variant="primary"
        disabled={!sponsor}
        loading={loading}
        onPress={onConfirm}
        accessibilityLabel="Confirm sponsor change"
        style={{ marginTop: 12 }}
      />
    </BottomSheet>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionHeading, { color: colors.text }]}>{title}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  pageTitle: { fontFamily: FONTS.hero, fontSize: 48, letterSpacing: 1.5, marginBottom: 4 },
  section: { gap: 10 },
  sectionHeading: { fontFamily: FONTS.heading, fontSize: 22 },
  stack: { gap: 10 },
  divider: { height: 1, marginVertical: 12 },
  emptyText: { fontFamily: FONTS.body, fontSize: 13 },
  retryText: { fontFamily: FONTS.semibold, fontSize: 13, marginTop: 6 },

  // Affiliation
  affiliationHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sponsorBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sponsorName: { fontFamily: FONTS.heading, fontSize: 18 },
  sponsorMeta: { fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },
  impactLabel: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  statChipValue: { fontFamily: FONTS.heading, fontSize: 14 },
  statChipLabel: { fontFamily: FONTS.body, fontSize: 11 },
  changeBtn: { alignSelf: 'flex-start', marginTop: 12, height: 40, paddingHorizontal: 20 },

  // Active sponsors carousel
  carousel: { gap: 12, paddingRight: 4 },
  sponsorCard: { width: 220, gap: 8 },
  sponsorCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sponsorLogoBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rankBadgeText: { fontFamily: FONTS.heading, fontSize: 14 },
  sponsorCardName: { fontFamily: FONTS.heading, fontSize: 16 },
  sponsorStats: { gap: 5 },
  sponsorStatItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sponsorStatText: { fontFamily: FONTS.body, fontSize: 12 },

  // Prizes
  prizeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  prizeTitle: { fontFamily: FONTS.heading, fontSize: 16, flex: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontFamily: FONTS.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  prizeMeta: { fontFamily: FONTS.body, fontSize: 13, marginTop: 4 },

  // Newsletters
  newsletterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  newsletterLabel: { fontFamily: FONTS.semibold, fontSize: 14 },

  // Archive
  archiveHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  archiveBadge: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  archiveBadgeText: { fontFamily: FONTS.heading, fontSize: 22 },
  archiveName: { fontFamily: FONTS.heading, fontSize: 16 },
  archiveMeta: { fontFamily: FONTS.body, fontSize: 12, marginTop: 3 },
  socialRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  socialBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Change sponsor sheet
  sheetWarning: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  sponsorRadioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  sponsorRadioName: { fontFamily: FONTS.semibold, fontSize: 14 },
  sponsorRadioMeta: { fontFamily: FONTS.body, fontSize: 12 },
});






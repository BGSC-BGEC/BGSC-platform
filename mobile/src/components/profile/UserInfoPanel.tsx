import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRef, useState } from 'react';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { SponsorStats, SocialLink } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const PLATFORM_ICONS: Record<SocialLink['platform'], string> = {
  discord: '🎮',
  instagram: '📸',
  linkedin: '💼',
  x: '𝕏',
  twitch: '📡',
  youtube: '▶️',
};

export function UserInfoPanel() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);
  const [expanded, setExpanded] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: UserRepository.getProfile,
    enabled: status === 'authenticated',
  });

  const { data: sponsorStats, isLoading: sponsorLoading } = useQuery({
    queryKey: ['sponsorStats'],
    queryFn: UserRepository.getSponsorStats,
    enabled: status === 'authenticated',
  });

  const copyToClipboard = async (value: string, key: string) => {
    await Clipboard.setStringAsync(value);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    setCopiedKey(key);
    copiedTimer.current = setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <View style={[s.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <Pressable style={s.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={[s.headerTitle, { color: colors.text }]}>ℹ️ User Info</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View style={s.body}>
          {profileLoading ? (
            <PanelSkeleton colors={colors} />
          ) : profile ? (
            <>
              {/* Friend tags */}
              {profile.friendTags.length > 0 && (
                <Section title="Tags from friends" colors={colors}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {profile.friendTags.map((tag) => (
                      <View key={tag} style={[s.friendTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                        <Text style={[s.friendTagText, { color: colors.text }]}>{tag}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </Section>
              )}

              {/* Contact info */}
              <Section title="Contact" colors={colors}>
                <InfoRow
                  label="Email"
                  value={profile.email}
                  onPress={() => copyToClipboard(profile.email, 'email')}
                  copied={copiedKey === 'email'}
                  colors={colors}
                />
                {profile.contact ? (
                  <InfoRow
                    label="Phone"
                    value={profile.contact}
                    onPress={() => copyToClipboard(profile.contact!, 'phone')}
                    copied={copiedKey === 'phone'}
                    colors={colors}
                  />
                ) : null}
                {profile.newsletterSubscriptions.length > 0 && (
                  <InfoRow
                    label="Newsletters"
                    value={profile.newsletterSubscriptions.join(' · ')}
                    colors={colors}
                  />
                )}
              </Section>

              {/* Strava */}
              <Section title="🏃 Strava" colors={colors}>
                <Text style={[s.connectText, { color: colors.textMuted }]}>
                  No activity recorded yet
                </Text>
                <Pressable style={[s.connectBtn, { borderColor: colors.accent }]}>
                  <Text style={[s.connectBtnText, { color: colors.accent }]}>Connect Strava</Text>
                </Pressable>
              </Section>

              {/* Steam */}
              <Section title="🎮 Steam" colors={colors}>
                <Text style={[s.connectText, { color: colors.textMuted }]}>
                  No activity recorded yet
                </Text>
                <Pressable style={[s.connectBtn, { borderColor: colors.accent }]}>
                  <Text style={[s.connectBtnText, { color: colors.accent }]}>Connect Steam</Text>
                </Pressable>
              </Section>

              {/* Sponsor stats */}
              <Section title="Sponsor Stats" colors={colors}>
                {sponsorLoading ? (
                  <View style={{ gap: 8 }}>
                    <SkeletonBox width="40%" height={20} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[1, 2, 3].map((i) => <SkeletonBox key={i} style={{ flex: 1 }} height={60} borderRadius={8} />)}
                    </View>
                  </View>
                ) : sponsorStats ? (
                  <SponsorStatsBlock stats={sponsorStats} colors={colors} />
                ) : (
                  <Text style={[s.connectText, { color: colors.textMuted }]}>
                    Not affiliated with a sponsor yet
                  </Text>
                )}
              </Section>

              {/* Social links */}
              {profile.socialLinks.length > 0 && (
                <Section title="Social" colors={colors}>
                  <View style={s.socialRow}>
                    {profile.socialLinks.map((link) => (
                      <Pressable
                        key={link.platform}
                        onPress={() => Linking.openURL(link.url)}
                        style={[s.socialIcon, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                        accessibilityLabel={link.platform}
                      >
                        <Text style={s.socialIconText}>{PLATFORM_ICONS[link.platform]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Section>
              )}
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  onPress,
  copied,
  colors,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  copied?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable style={s.infoRow} onPress={onPress}>
      <Text style={[s.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.infoValue, { color: copied ? colors.success : colors.text }]} numberOfLines={1}>
        {copied ? 'Copied! ✓' : value}
      </Text>
    </Pressable>
  );
}

function SponsorStatsBlock({
  stats,
  colors,
}: {
  stats: SponsorStats;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[s.sponsorName, { color: colors.text }]}>{stats.sponsorName}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { label: `Rank\n(of ${stats.totalAffiliates})`, value: `#${stats.rank}` },
          { label: 'Fans\nContributed', value: fmt(stats.fansContributed) },
          { label: 'Events\nWon', value: String(stats.eventsWon) },
        ].map((item) => (
          <View key={item.label} style={[s.sponsorStatBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[s.sponsorStatValue, { color: colors.text }]}>{item.value}</Text>
            <Text style={[s.sponsorStatLabel, { color: colors.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PanelSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 12 }}>
      {[1, 2, 3, 4].map((i) => <SkeletonBox key={i} width="100%" height={16} />)}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, marginHorizontal: 16, marginBottom: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 0 },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },

  friendTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginRight: 8 },
  friendTagText: { fontSize: 12 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, flex: 0.4 },
  infoValue: { fontSize: 13, flex: 0.6, textAlign: 'right' },

  connectText: { fontSize: 13, marginBottom: 8 },
  connectBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  connectBtnText: { fontSize: 13, fontWeight: '600' },

  sponsorName: { fontSize: 15, fontWeight: '600' },
  sponsorStatBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  sponsorStatValue: { fontSize: 16, fontWeight: '700' },
  sponsorStatLabel: { fontSize: 10, textAlign: 'center', marginTop: 2 },

  socialRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  socialIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  socialIconText: { fontSize: 18 },
});

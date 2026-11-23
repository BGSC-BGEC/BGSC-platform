import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { hallOfFameRepository } from '../../src/repositories/HallOfFameRepository';
import { resolveMediaUrl } from '../../src/api/config';
import { formatDate, HOF_CATEGORY_LABELS } from '../../src/utils/format';
import { shareHallOfFame } from '../drawer/hall-of-fame';

/**
 * One honour, laid out like an article: cover, kicker, title, honoree byline, a pull quote, the
 * story, the facts as label / value rows, then the roster as a plain list.
 */
export default function HallOfFameDetail() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const ref: string = route.params?.slugOrId ?? route.params?.ref;
  const { data: entry, loading, error, reload, refreshing } = useAsyncResource(() => hallOfFameRepository.get(ref), [ref]);

  if (loading || error || !entry) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Hall of Fame" showBackButton showMenuButton={false} />
        {loading ? (
          <View style={[styles.content, styles.loading]}>
            <Skeleton height={12} width="40%" />
            <Skeleton height={30} width="85%" />
            <Skeleton height={56} width={220} borderRadius={28} />
            <Skeleton height={14} width="100%" />
            <Skeleton height={14} width="90%" />
          </View>
        ) : (
          <ErrorState title="Could not load this honour" message={error ?? undefined} onRetry={() => void reload()} />
        )}
      </SafeAreaView>
    );
  }

  const cover = resolveMediaUrl(entry.cover_url ?? entry.media_url);
  const members = (entry.members ?? []).filter((m) => !m.deleted);
  const { achievement } = entry;
  const hairline = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border };
  const facts = [
    { label: 'Year', value: String(achievement.year) },
    achievement.season ? { label: 'Season', value: achievement.season } : null,
    achievement.domain ? { label: 'Domain', value: achievement.domain } : null,
    achievement.difficulty ? { label: 'Difficulty', value: achievement.difficulty } : null,
    achievement.award_points ? { label: 'Points awarded', value: `+${achievement.award_points}` } : null,
    entry.tags?.length ? { label: 'Tags', value: entry.tags.join(', ') } : null,
  ].filter((f): f is { label: string; value: string } => f != null);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Hall of Fame" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.accent} />}>
        {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={200} /> : null}

        <View style={styles.headline}>
          <Typography color="primary" style={styles.kicker}>
            {HOF_CATEGORY_LABELS[entry.category]?.toUpperCase()} · {(achievement.season ?? String(achievement.year)).toUpperCase()}
          </Typography>
          <Typography variant="displayTitle">{entry.title}</Typography>
        </View>

        <View style={[styles.honoree, hairline]}>
          <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={48} />
          <View style={styles.flex}>
            <Typography variant="h3" color="text">{entry.honoree.display_name}</Typography>
            <Typography variant="bodySmall" color="textMuted">
              {entry.honoree.type === 'team' ? 'Team' : 'Member'} · Inducted {formatDate(entry.created_at, { day: undefined })}
            </Typography>
          </View>
        </View>

        {/* Pull quote: an orange rule on the left, no box */}
        {entry.quote ? (
          <View style={[styles.quoteWrap, { borderLeftColor: colors.primary }]}>
            <Typography variant="h3" color="text" style={styles.quote}>“{entry.quote}”</Typography>
          </View>
        ) : null}

        {entry.description ? (
          <View style={styles.section}>
            <Typography color="text" style={styles.heading}>The story</Typography>
            <Typography variant="body" color="textMuted" style={styles.bodyText}>{entry.description}</Typography>
          </View>
        ) : null}

        <View style={styles.section}>
          <Typography color="text" style={styles.heading}>Achievements</Typography>
          <View>
            {facts.map((f, i) => (
              <View key={f.label} style={[styles.fact, i < facts.length - 1 && hairline]}>
                <Typography color="textMuted" style={styles.factLabel}>{f.label}</Typography>
                <Typography color="text" style={styles.factValue}>{f.value}</Typography>
              </View>
            ))}
          </View>
        </View>

        {members.length > 0 ? (
          <View style={styles.section}>
            <Typography color="text" style={styles.heading}>
              Roster <Typography color="textMuted" style={styles.heading}>· {members.length}</Typography>
            </Typography>
            <View>
              {members.map((member, i) => (
                <View key={member.user_id} style={[styles.memberRow, i < members.length - 1 && hairline]}>
                  <Avatar name={member.display_name} uri={member.avatar_url} size={32} />
                  <Typography variant="body">{member.display_name}</Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {entry.source.type === 'event' && entry.source.id ? (
            <Button
              label={`View ${entry.source.title ?? 'event'}`}
              variant="outline"
              fullWidth
              onPress={() => navigation.navigate('EventStandings', { ref: entry.source.id })}
            />
          ) : entry.source.type === 'challenge' && entry.source.id ? (
            <Button
              label={`View ${entry.source.title ?? 'challenge'}`}
              variant="outline"
              fullWidth
              onPress={() => navigation.navigate('ChallengeDetail', { key: entry.source.id })}
            />
          ) : null}
          <Button label="Share" leftIcon="share" fullWidth onPress={() => shareHallOfFame(entry)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, gap: 24, paddingBottom: 40 },
  loading: { gap: 14 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14 },
  headline: { gap: 6 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
  honoree: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18, marginTop: -6 },
  flex: { flex: 1, gap: 2 },
  quoteWrap: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 2 },
  quote: { fontStyle: 'italic' },
  section: { gap: 8 },
  heading: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 17, lineHeight: 22 },
  bodyText: { fontSize: 15.5, lineHeight: 24 },
  fact: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingVertical: 12 },
  factLabel: { fontSize: 14, lineHeight: 20 },
  factValue: { flexShrink: 1, textAlign: 'right', fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14, lineHeight: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  actions: { gap: 10, marginTop: 4 },
});

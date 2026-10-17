import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { hallOfFameRepository } from '../../src/repositories/HallOfFameRepository';
import { resolveMediaUrl } from '../../src/api/config';
import { formatDate, HOF_CATEGORY_LABELS } from '../../src/utils/format';
import { shareHallOfFame } from '../drawer/hall-of-fame';

export default function HallOfFameDetail() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const ref: string = route.params?.ref;
  const { data: entry, loading, error, reload } = useAsyncResource(() => hallOfFameRepository.get(ref), [ref]);

  if (loading || error || !entry) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Hall of Fame" showBackButton showMenuButton={false} />
        {loading ? (
          <View style={styles.content}>
            <Skeleton height={180} borderRadius={24} />
            <Skeleton.Card />
          </View>
        ) : (
          <ErrorState title="Could not load this honour" message={error ?? undefined} onRetry={() => void reload()} />
        )}
      </SafeAreaView>
    );
  }

  const cover = resolveMediaUrl(entry.cover_url ?? entry.media_url);
  const members = entry.members.filter((m) => !m.deleted);
  const { achievement } = entry;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Hall of Fame" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.accentMuted }]}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={200} /> : null}
          <View style={styles.badges}>
            <Badge label={HOF_CATEGORY_LABELS[entry.category]} variant="primary" icon="trophy" />
            <Badge label={achievement.season ?? String(achievement.year)} variant="muted" />
          </View>
          <Typography variant="displayTitle">{entry.title}</Typography>
          <View style={styles.honoree}>
            <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={56} />
            <View style={styles.flex}>
              <Typography variant="h2">{entry.honoree.display_name}</Typography>
              <Typography variant="caption" color="textMuted">
                {entry.honoree.type === 'team' ? 'Team' : 'Member'} · Inducted {formatDate(entry.created_at, { day: undefined })}
              </Typography>
            </View>
          </View>
        </View>

        {entry.quote ? (
          <Card variant="inner">
            <Typography variant="h3" style={styles.quote}>“{entry.quote}”</Typography>
          </Card>
        ) : null}

        {entry.description ? (
          <Card variant="solid">
            <Card.Header title="The story" />
            <Card.Body>
              <Typography variant="body" color="textMuted">{entry.description}</Typography>
            </Card.Body>
          </Card>
        ) : null}

        <Card variant="solid">
          <Card.Header title="Achievements" />
          <View style={styles.badgeWrap}>
            <Badge label={`Year ${achievement.year}`} variant="primary" icon="calendar" />
            {achievement.domain ? <Badge label={achievement.domain} variant="muted" /> : null}
            {achievement.difficulty ? <Badge label={achievement.difficulty} variant="warning" icon="flame-outline" /> : null}
            {achievement.award_points ? <Badge label={`+${achievement.award_points} points`} variant="success" icon="star" /> : null}
            {entry.tags.map((tag) => (
              <Badge key={tag} label={tag} variant="muted" />
            ))}
          </View>
        </Card>

        {members.length > 0 ? (
          <Card variant="solid">
            <Card.Header title="Roster" rightAction={<Badge label={`${members.length}`} variant="muted" />} />
            {members.map((member) => (
              <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                <Avatar name={member.display_name} uri={member.avatar_url} size={32} />
                <Typography variant="body">{member.display_name}</Typography>
              </View>
            ))}
          </Card>
        ) : null}

        {entry.source.type === 'event' && entry.source.id ? (
          <Button
            label={`View ${entry.source.title ?? 'event'}`}
            variant="outline"
            fullWidth
            onPress={() => navigation.navigate('EventDetails', { eventId: entry.source.id })}
          />
        ) : null}
        <Button label="Share" leftIcon="share" fullWidth onPress={() => shareHallOfFame(entry)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 20, borderRadius: 24, gap: 12, overflow: 'hidden' },
  cover: { height: 170, borderRadius: 16 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  honoree: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  quote: { fontStyle: 'italic' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

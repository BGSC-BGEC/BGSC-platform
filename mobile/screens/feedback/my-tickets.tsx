import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/forms/TextInput';
import { FilterChips } from '../../src/components/FilterChips';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { ErrorState } from '../../src/feedback/ErrorState';
import { EmptyState } from '../../src/feedback/EmptyState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { getErrorMessage } from '../../src/api/client';
import { feedbackRepository, type FeedbackStatus, type FeedbackTicket } from '../../src/repositories/FeedbackRepository';
import { formatDate } from '../../src/utils/format';

export default function MyTickets() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const navigation = useNavigation<any>();
  const [ticketNumber, setTicketNumber] = useState('');
  const [group, setGroup] = useState<'all' | 'open' | 'closed'>('open');
  const [status, setStatus] = useState<'all' | FeedbackStatus>('all');
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async (next?: string) => {
    const id = ++request.current;
    setBusy(true); setError(null);
    try {
      const page = await feedbackRepository.mine(status === 'all' ? undefined : status, next);
      if (id !== request.current) return;
      setTickets((prev) => next ? [...prev, ...page.tickets] : page.tickets);
      setCursor(page.next_cursor);
    } catch (err) { if (id === request.current) setError(getErrorMessage(err)); }
    finally { if (id === request.current) { setLoading(false); setBusy(false); } }
  }, [status]);
  useEffect(() => { setLoading(true); void load(); return () => { request.current++; }; }, [load]);
  const visibleTickets = useMemo(() => {
    if (status !== 'all' || group === 'all') return tickets;
    return tickets.filter((t) =>
      group === 'open' ? t.status === 'submitted' || t.status === 'under_review' : t.status === 'resolved' || t.status === 'closed',
    );
  }, [tickets, status, group]);
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['left', 'right']}>
    <AppHeader title="My tickets" showBackButton showMenuButton={false} />
    <FlatList data={loading ? [] : visibleTickets} keyExtractor={(item) => item.ticket_no} contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]}
      refreshControl={<RefreshControl refreshing={busy && !loading} onRefresh={() => void load()} tintColor={colors.accent} />}
      ListHeaderComponent={<View style={styles.header}>
        <SegmentedTabs
          tabs={[
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
            { label: 'All', value: 'all' },
          ]}
          value={group}
          onChange={(nextGroup) => {
            setGroup(nextGroup);
            setStatus('all');
          }}
        />
        <FilterChips options={[{ label: 'All', value: 'all' }, { label: 'Submitted', value: 'submitted' }, { label: 'Under review', value: 'under_review' }, { label: 'Resolved', value: 'resolved' }, { label: 'Closed', value: 'closed' }]} value={status} onChange={(nextStatus) => {
          setStatus(nextStatus);
          if (nextStatus === 'submitted' || nextStatus === 'under_review') setGroup('open');
          else if (nextStatus === 'resolved' || nextStatus === 'closed') setGroup('closed');
        }} />
        <Typography variant="caption" color="textMuted">Anonymous tickets can only be opened using their ticket number.</Typography>
        <TextInput label="Open a ticket by number" value={ticketNumber} onChangeText={setTicketNumber} autoCapitalize="characters" autoCorrect={false} maxLength={11} placeholder="BG-XXXXXXXX" />
        <Button label="Open ticket" variant="outline" disabled={!/^BG-[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/.test(ticketNumber.trim().toUpperCase())} onPress={() => navigation.navigate('FeedbackSuccess', { ticket_no: ticketNumber.trim().toUpperCase() })} />
        {error ? <ErrorState title="Could not load tickets" message={error} onRetry={() => void load()} /> : null}
      </View>}
      renderItem={({ item }) => <Card onPress={() => navigation.navigate('FeedbackSuccess', { ticket_no: item.ticket_no })}>
        <View style={styles.row}><Typography variant="mono" color="textMuted" style={styles.flex}>{item.ticket_no}</Typography><Badge label={item.status.replace('_', ' ')} variant={item.status === 'resolved' ? 'success' : 'muted'} /></View>
        <Typography variant="h3">{item.subject}</Typography>
        <View style={styles.row}><Badge label={item.category} variant="muted" /><Badge label={item.severity} variant={item.severity === 'high' || item.severity === 'critical' ? 'danger' : 'warning'} /></View>
        <Typography variant="caption" color="textMuted">{formatDate(item.created_at)}</Typography>
        {item.response ? <Card variant="inner"><Typography variant="label">Team response</Typography><Typography>{item.response.body}</Typography></Card> : null}
      </Card>}
      ListEmptyComponent={loading ? <><Skeleton.Card /><Skeleton.Card /></> : !error ? <EmptyState icon="message" title="No tickets here" description="Your feedback and the team's responses will appear here." /> : undefined}
      ListFooterComponent={cursor ? <Button label="Load more" variant="outline" loading={busy} onPress={() => void load(cursor)} /> : undefined} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }, header: { gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, flex: { flex: 1 } });

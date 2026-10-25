import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { ProfileLayout } from './profile-layout';
import { notificationsRepository, type ApiNotification } from '../../src/repositories/NotificationsRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { FilterChips } from '../../src/components/FilterChips';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { EmptyState } from '../../src/feedback/EmptyState';
import { getErrorMessage } from '../../src/api/client';
import { formatRelative } from '../../src/utils/format';
import { notificationTarget } from '../../src/utils/account';

export default function Notifications() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [category, setCategory] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inbox = useAsyncResource(() => notificationsRepository.inbox({ ...(tab === 'unread' ? { unread: true } : {}), ...(category !== 'all' ? { category } : {}) }), [tab, category]);
  const act = async (task: () => Promise<unknown>, refresh = true) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await task(); if (refresh) await inbox.reload(); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  const open = (item: ApiNotification) => void act(async () => { if (!item.read_at) await notificationsRepository.markAsRead(item._id); const target = notificationTarget(item.data); navigation.navigate(target.route, target.params); });
  const loadMore = () => void act(async () => {
    const cursor = inbox.data?.next_cursor;
    if (!cursor) return;
    const page = await notificationsRepository.inbox({ cursor, ...(tab === 'unread' ? { unread: true } : {}), ...(category !== 'all' ? { category } : {}) });
    inbox.setData(prev => prev ? { notifications: [...prev.notifications, ...page.notifications.filter(n => !prev.notifications.some(old => old._id === n._id))], next_cursor: page.next_cursor } : page);
  }, false);
  return <ProfileLayout title="Notifications" refreshing={inbox.refreshing} onRefresh={() => void inbox.reload()}>
    <SegmentedTabs tabs={[{ label: 'All', value: 'all' }, { label: 'Unread', value: 'unread' }]} value={tab} onChange={setTab} />
    <Button label="Read all" variant="ghost" disabled={busy} onPress={() => void act(() => notificationsRepository.markAllAsRead())} />
    <FilterChips options={[{ label: 'All', value: 'all' }, { label: 'Events', value: 'event' }, { label: 'Challenges', value: 'challenge' }, { label: 'Announcements', value: 'announcement' }, { label: 'System', value: 'system' }]} value={category} onChange={setCategory} />
    {(error || inbox.error) && <ErrorState message={error || inbox.error || ''} onRetry={() => void inbox.reload()} />}
    {inbox.loading ? <><Skeleton.Card /><Skeleton.Card /></> : inbox.data?.notifications.length === 0 ? <EmptyState title="You’re all caught up" description="Your notifications will appear here." icon="bell" /> : inbox.data?.notifications.map(item => <Card key={item._id} variant={item.read_at ? 'solid' : 'accent'} onPress={() => open(item)}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Typography variant="button" style={{ flex: 1 }}>{item.title}</Typography>{!item.read_at && <Badge label="New" variant="primary" />}</View>
      <Typography color="textMuted">{item.body}</Typography><Typography variant="caption" color="textMuted">{formatRelative(item.created_at)}</Typography>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Open" variant="ghost" disabled={busy} onPress={() => open(item)} /><Button label="Dismiss" variant="ghost" disabled={busy} onPress={() => void act(() => notificationsRepository.deleteNotification(item._id))} /></View>
    </Card>)}
    {inbox.data?.next_cursor && <Button label="Load more" variant="outline" loading={busy} onPress={loadMore} />}
  </ProfileLayout>;
}

import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { feedbackRepository } from '../../src/repositories/FeedbackRepository';

export default function FeedbackSuccess() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const ticketNo: string = route.params?.ticket_no ?? '';
  const [copied, setCopied] = useState(false);
  const ticket = useAsyncResource(() => feedbackRepository.get(ticketNo), [ticketNo]);
  const copyOrShare = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ticketNo);
      } else {
        await Share.share({ message: ticketNo });
      }
      setCopied(true);
    } catch {
      /* ignore share dismissal */
    }
  };
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['left', 'right']}>
    <AppHeader title="Feedback" showBackButton showMenuButton={false} />
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]} refreshControl={<RefreshControl refreshing={ticket.refreshing} onRefresh={() => void ticket.reload()} tintColor={colors.accent} />}>
      <View style={[styles.check, { backgroundColor: colors.successMuted }]}><Icon name="check" color="success" size={40} /></View>
      <Typography variant="displayTitle" align="center">Got it. Thank you.</Typography>
      <Typography color="textMuted" align="center">Keep your ticket number to check the team's response.</Typography>
      <Card>
        <Typography variant="label" align="center">Your ticket</Typography>
        <Typography variant="mono" align="center" selectable>{ticketNo}</Typography>
        <Typography variant="caption" color={copied ? 'success' : 'textMuted'} align="center">
          {copied ? 'Ticket number ready to paste or shared.' : 'Press and hold the number to copy it, or tap below.'}
        </Typography>
        <Button label={copied ? 'Copied / Shared' : 'Copy or share ticket number'} variant="outline" leftIcon="copy-outline" onPress={() => void copyOrShare()} />
      </Card>
      {ticket.loading ? <Skeleton.Card /> : ticket.error ? <ErrorState title="Ticket saved; status unavailable" message={ticket.error} onRetry={() => void ticket.reload()} /> : ticket.data ? <Card>
        <Badge label={ticket.data.status.replace('_', ' ')} variant={ticket.data.status === 'resolved' ? 'success' : 'muted'} />
        <Typography variant="h3">{ticket.data.subject}</Typography>
        <Typography color="textMuted">{ticket.data.description}</Typography>
        {ticket.data.response ? <><Typography variant="label">Team response</Typography><Typography>{ticket.data.response.body}</Typography></> : null}
        {ticket.data.is_anonymous ? <Typography variant="caption" color="textMuted">This anonymous ticket is accessible using its number and will not appear in My tickets.</Typography> : null}
      </Card> : null}
      <Button label="View my tickets" onPress={() => navigation.navigate('MyTickets')} />
      <Button label="Back to home" variant="outline" onPress={() => navigation.navigate('App', { screen: 'MainTabs', params: { screen: 'HomeTab' } })} />
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 720, alignSelf: 'center' }, check: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginTop: 20 } });

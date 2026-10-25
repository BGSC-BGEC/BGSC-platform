import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../../src/feedback/Alert';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { AppHeader } from '../../src/components/AppHeader';
import { OptionTile } from '../../src/components/OptionTile';
import { SeverityPill } from '../../src/components/SeverityPill';
import { SearchInput } from '../../src/forms/SearchInput';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { TextInput } from '../../src/forms/TextInput';
import { TextArea } from '../../src/forms/TextArea';
import { Switch } from '../../src/forms/Switch';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { getErrorMessage } from '../../src/api/client';
import { feedbackRepository, type FeedbackCategory, type FeedbackSeverity } from '../../src/repositories/FeedbackRepository';
import { attachmentUrls } from '../../src/utils/community';

export default function Feedback() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [eventSearch, setEventSearch] = useState('');
  const [eventId, setEventId] = useState<string | undefined>();
  const [eventTitle, setEventTitle] = useState('');
  const events = useAsyncResource(() => eventsRepository.list({ search: eventSearch, limit: 10 }), [eventSearch], { enabled: eventSearch.length > 1 });
  const [kind, setKind] = useState<'feedback' | 'contact'>('feedback');
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [severity, setSeverity] = useState<FeedbackSeverity>('low');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (route.params?.kind === 'contact') setKind('contact');
    if (route.params?.reportMediaId) { setCategory('complaint'); setSubject(`Report media ${route.params.reportMediaId}`); }
  }, [route.params?.kind, route.params?.reportMediaId]);

  const submit = async () => {
    if (submitting.current) return;
    try {
      if (!subject.trim() || !description.trim()) throw new Error('Add a subject and message before sending.');
      if (anonymous && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter an email address so we can reply.');
      const links = attachmentUrls(attachments);
      submitting.current = true;
      setSending(true);
      setError(null);
      const receipt = await feedbackRepository.submit({ subject: subject.trim(), description: description.trim(), category, severity,
        attachments: links, event_id: eventId, is_anonymous: anonymous, ...(anonymous ? { contact_email: email.trim() } : {}) }, kind === 'contact');
      setSubject(''); setDescription(''); setAttachments('');
      navigation.navigate('FeedbackSuccess', { ticket_no: receipt.ticket_no });
    } catch (err) { setError(getErrorMessage(err)); }
    finally { submitting.current = false; setSending(false); }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Feedback & contact" />
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]} keyboardShouldPersistTaps="handled">
          <Typography variant="displayTitle">Help us make BGSC better.</Typography>
          <Typography color="textMuted">Bugs, ideas, complaints — it all reaches the core team.</Typography>
          <SegmentedTabs tabs={[{ label: 'Feedback', value: 'feedback' }, { label: 'Contact us', value: 'contact' }]} value={kind} onChange={setKind} />
          <Card>
            {kind === 'feedback' ? <>
              <Typography variant="h3">What is this about?</Typography>
              <View style={styles.options}>{([{ label: 'Bug', value: 'bug' }, { label: 'Idea', value: 'feature' }, { label: 'Complaint', value: 'complaint' }, { label: 'General', value: 'general' }] as const).map((item) => <OptionTile key={item.value} label={item.label} selected={category === item.value} onPress={() => setCategory(item.value)} />)}</View>
              <Typography variant="label">How much does it affect you?</Typography>
              <View style={styles.options}>{(['low', 'medium', 'high', 'critical'] as const).map((item) => <SeverityPill key={item} label={item[0].toUpperCase() + item.slice(1)} selected={severity === item} onPress={() => setSeverity(item)} />)}</View>
            </> : null}
            <TextInput label="Subject" value={subject} onChangeText={setSubject} maxLength={140} showCharCount placeholder="A short summary" />
            <TextArea label="Your message" value={description} onChangeText={setDescription} placeholder="What happened, or what would you like to see?" maxLength={5000} showCharCount />
            <TextArea label="Attachment links (optional)" value={attachments} onChangeText={setAttachments} autoCapitalize="none" placeholder="https://…" helperText="Up to five links, one per line. Only share files you want the support team to see." />
            <Typography variant="label">Related event (optional)</Typography>
            {eventId ? <><Typography>{eventTitle}</Typography><Button label="Remove related event" variant="ghost" onPress={() => { setEventId(undefined); setEventTitle(''); }} /></> : <>
              <SearchInput value={eventSearch} onSearch={setEventSearch} placeholder="Search events" />
              {eventSearch.length > 1 && events.loading ? <Typography color="textMuted">Searching events…</Typography> : null}
              {eventSearch.length > 1 && events.error ? <Alert variant="error" title="Event search unavailable" description={events.error} /> : null}
              {eventSearch.length > 1 ? events.data?.events.map((event) => <Button key={event._id} label={event.title} variant="outline" onPress={() => { setEventId(event._id); setEventTitle(event.title); setEventSearch(''); }} />) : null}
            </>}
            <View style={styles.row}>
              <View style={styles.flex}><Typography variant="h4">Send anonymously</Typography><Typography variant="caption" color="textMuted">Your account will not be attached to this ticket.</Typography></View>
              <Switch value={anonymous} onValueChange={setAnonymous} accessibilityLabel="Send feedback anonymously" />
            </View>
            {anonymous ? <>
              <TextInput label="Reply email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={200} />
              <Typography variant="caption" color="textMuted">Keep your ticket number. Anonymous tickets do not appear in My tickets; anyone with the number can view the ticket.</Typography>
            </> : null}
            {error ? <Alert variant="error" title="Could not send" description={error} /> : null}
            <Button label={kind === 'contact' ? 'Send message' : 'Send feedback'} fullWidth loading={sending} disabled={!subject.trim() || !description.trim()} onPress={() => void submit()} />
          </Card>
          <Button label="My tickets" variant="outline" onPress={() => navigation.navigate('MyTickets')} />
          <Button label="Contact & FAQ" variant="ghost" onPress={() => navigation.navigate('ContactFaq')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ safeArea: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, gap: 4 } });

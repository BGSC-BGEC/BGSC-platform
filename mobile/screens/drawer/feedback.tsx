import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../../src/feedback/Alert';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { RadioGroup } from '../../src/forms/RadioGroup';
import { TextArea } from '../../src/forms/TextArea';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Feedback() {
  const { colors } = useTheme();
  const [category, setCategory] = useState('experience');
  const [message, setMessage] = useState('');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Typography variant="displayTitle">Feedback</Typography>
        <Typography variant="body" color="textMuted">Help us make the BGSC experience better.</Typography>
        <Alert variant="info" title="Your feedback matters" description="Tell us what worked and what we can improve." />
        <Card variant="glass">
          <Typography variant="h3">What is this about?</Typography>
          <RadioGroup value={category} onChange={setCategory} options={[
            { label: 'App experience', value: 'experience', subtitle: 'Usability, bugs, or ideas' },
            { label: 'Event or tournament', value: 'event', subtitle: 'A specific BGSC activity' },
            { label: 'Something else', value: 'other' },
          ]} />
          <TextArea label="Your message" value={message} onChangeText={setMessage} placeholder="Write your feedback..." maxLength={500} showCharCount helperText="Please avoid sharing sensitive information." />
          <Button label="Send feedback" fullWidth onPress={() => {}} disabled={!message.trim()} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, content: { padding: 20, gap: 16 } });
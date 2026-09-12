import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Checkbox } from '../../src/forms/Checkbox';
import { Select } from '../../src/forms/Select';
import { TextInput } from '../../src/forms/TextInput';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function EventRegistration() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [name, setName] = useState('Jeet Patel');
  const [team, setTeam] = useState('');
  const [position, setPosition] = useState<string | undefined>();
  const [terms, setTerms] = useState(false);

  const submit = () => {
    if (!name.trim() || !team.trim() || !position || !terms) {
      Alert.alert('Almost there', 'Complete every field and accept the event terms before submitting.');
      return;
    }
    Alert.alert('Registration submitted', 'Your place in Football Championship is reserved.', [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Registration" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Typography variant="displayTitle">Football Championship</Typography>
        <Typography variant="body" color="textMuted">Tell us a little about your participation.</Typography>
        <Card variant="solid">
          <TextInput label="FULL NAME" value={name} onChangeText={setName} placeholder="Your name" />
          <TextInput label="TEAM NAME" value={team} onChangeText={setTeam} placeholder="Enter your team name" />
          <Select
            label="PLAYING POSITION"
            placeholder="Choose a position"
            value={position}
            onChange={(value) => setPosition(value as string)}
            options={[
              { label: 'Goalkeeper', value: 'goalkeeper' },
              { label: 'Defender', value: 'defender' },
              { label: 'Midfielder', value: 'midfielder' },
              { label: 'Forward', value: 'forward' },
            ]}
          />
          <Checkbox checked={terms} onChange={setTerms} label="I agree to the event rules and attendance policy" />
        </Card>
        <Button label="Submit registration" fullWidth onPress={submit} />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
});

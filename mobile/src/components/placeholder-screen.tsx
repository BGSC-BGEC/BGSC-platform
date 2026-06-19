import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { useColors } from '@/hooks/use-colors';

/** Stub for drawer destinations whose features land in later milestones. */
export function PlaceholderScreen({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Screen center>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        Coming in a later milestone.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  body: { fontSize: 15 },
});

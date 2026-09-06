import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Typography } from '../typography/Typography';

export function AuthDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Typography variant="labelSmall" style={styles.orText}>
        OR
      </Typography>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#D6CFC7',
  },
  orText: {
    color: '#8A8279',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
});


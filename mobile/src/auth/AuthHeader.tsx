import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../typography/Typography';

export function AuthHeader() {
  return (
    <View style={styles.container}>
      <Ionicons name="game-controller" size={26} color="#111111" style={styles.icon} />
      <Typography
        variant="h1"
        style={styles.logoText}
      >
        BGSC
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  icon: {
    marginTop: -1,
  },
  logoText: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: 0.5,
  },
});
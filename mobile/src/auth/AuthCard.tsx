import React from 'react';
import {
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

interface AuthCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AuthCard({
  children,
  style,
}: AuthCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 36,
    backgroundColor: '#FFF8F2',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
});
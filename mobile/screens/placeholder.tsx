import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../src/components/AppHeader';
import { EmptyState } from '../src/feedback/EmptyState';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * Stand-in for routes whose v2 screen isn't built yet, so navigation into them works.
 * Replace the registration in screens/drawer/layout.tsx with the real screen when it lands.
 */
export function placeholder(title: string, { drawerRoot = false } = {}) {
  function Placeholder() {
    const { colors } = useTheme();
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title={title} showBackButton={!drawerRoot} showMenuButton={drawerRoot} />
        <EmptyState icon="sparkles" title={`${title} is on the way`} description="This screen is being rebuilt for v2." />
      </View>
    );
  }
  Placeholder.displayName = `Placeholder(${title})`;
  return Placeholder;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});

import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../typography/Typography';

interface AuthTabsProps {
  mode: 'login' | 'register';
  onChange: (mode: 'login' | 'register') => void;
}

export function AuthTabs({
  mode,
  onChange,
}: AuthTabsProps) {
  const handleSelect = (selectedMode: 'login' | 'register') => {
    if (selectedMode === mode) return;
    void Haptics.selectionAsync();
    onChange(selectedMode);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => handleSelect('login')}
        style={[
          styles.tab,
          mode === 'login' && styles.activeTab,
        ]}
      >
        <Typography
          variant="bodySmall"
          style={[
            styles.tabText,
            mode === 'login' ? styles.activeTabText : styles.inactiveTabText,
          ]}
        >
          Login
        </Typography>
      </Pressable>

      <Pressable
        onPress={() => handleSelect('register')}
        style={[
          styles.tab,
          mode === 'register' && styles.activeTab,
        ]}
      >
        <Typography
          variant="bodySmall"
          style={[
            styles.tabText,
            mode === 'register' ? styles.activeTabText : styles.inactiveTabText,
          ]}
        >
          Sign Up
        </Typography>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 20,
    backgroundColor: '#ECE6E0',
    padding: 3,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
  },
  activeTabText: {
    color: '#111111',
    fontWeight: '700',
  },
  inactiveTabText: {
    color: '#666666',
    fontWeight: '500',
  },
});
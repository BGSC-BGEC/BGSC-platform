import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '../typography/Typography';

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  type?: 'remember' | 'terms';
  onToSPress?: () => void;
  onPrivacyPress?: () => void;
}

export function AuthCheckbox({
  checked,
  onChange,
  type = 'remember',
  onToSPress,
  onPrivacyPress,
}: AuthCheckboxProps) {
  const handleToggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!checked);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={[
          styles.checkbox,
          checked && styles.checkboxActive,
        ]}
      >
        {checked && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </Pressable>

      {type === 'remember' ? (
        <Pressable onPress={handleToggle} style={styles.labelPressable}>
          <Typography variant="labelSmall" style={styles.labelText}>
            Remember me for a month
          </Typography>
        </Pressable>
      ) : (
        <View style={styles.termsRow}>
          <Typography variant="labelSmall" style={styles.labelText}>
            By signing up, you agree to our{' '}
          </Typography>
          <Pressable onPress={onToSPress}>
            <Typography variant="labelSmall" style={styles.linkText}>
              ToS
            </Typography>
          </Pressable>
          <Typography variant="labelSmall" style={styles.labelText}>
            {' '}and{' '}
          </Typography>
          <Pressable onPress={onPrivacyPress}>
            <Typography variant="labelSmall" style={styles.linkText}>
              Privacy Policy
            </Typography>
          </Pressable>
          <Typography variant="labelSmall" style={styles.labelText}>
            .
          </Typography>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: '#7A736A',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: '#375534',
    borderColor: '#375534',
  },
  labelPressable: {
    flex: 1,
  },
  labelText: {
    fontSize: 11,
    color: '#6E665D',
    lineHeight: 18,
  },
  termsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 11,
    color: '#1A1816',
    fontWeight: '700',
    textDecorationLine: 'underline',
    lineHeight: 18,
  },
});


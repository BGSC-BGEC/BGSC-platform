import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../typography/Typography';

interface OtpCellsProps {
  code: string;
  onChangeCode: (code: string) => void;
  length?: number;
}

export function OtpCells({
  code,
  onChangeCode,
  length = 4,
}: OtpCellsProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleCharChange = (text: string, index: number) => {
    // If multiple characters pasted
    if (text.length > 1) {
      const sanitized = text.replace(/\D/g, '').slice(0, length);
      onChangeCode(sanitized);
      const nextIndex = Math.min(sanitized.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const clean = text.replace(/\D/g, '');
    const codeArr = code.split('');
    codeArr[index] = clean;
    const newCode = codeArr.join('');
    onChangeCode(newCode);

    if (clean && index < length - 1) {
      void Haptics.selectionAsync();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => {
        const digit = code[index] || '';
        const isFocused = code.length === index;

        return (
          <Pressable
            key={index}
            onPress={() => inputRefs.current[index]?.focus()}
            style={[
              styles.cell,
              digit ? styles.cellFilled : styles.cellEmpty,
              isFocused && styles.cellFocused,
            ]}
          >
            <Typography variant="h1" style={styles.digitText}>
              {digit}
            </Typography>

            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={digit}
              onChangeText={(text) => handleCharChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              style={styles.hiddenInput}
              caretHidden
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 24,
  },
  cell: {
    width: 60,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D8D1C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cellFilled: {
    borderColor: '#222222',
  },
  cellEmpty: {
    borderColor: '#DCD6CE',
  },
  cellFocused: {
    borderColor: '#111111',
    borderWidth: 2,
  },
  digitText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111111',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
});


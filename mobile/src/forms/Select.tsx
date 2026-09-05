import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Label, Typography } from '../typography/Typography';
import { SearchInput } from './SearchInput';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  subtitle?: string;
  icon?: IconName;
}

export interface SelectProps<T = string> {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value?: T | T[];
  onChange: (value: T | T[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  error?: string | null;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export function Select<T = string>({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  searchPlaceholder = 'Filter options...',
  error,
  disabled = false,
  containerStyle,
}: SelectProps<T>) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize selected values to array
  const selectedValues = useMemo<T[]>(() => {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Text label to display in the trigger
  const displayLabel = useMemo(() => {
    if (selectedValues.length === 0) return null;
    if (multiple) {
      if (selectedValues.length === 1) {
        const found = options.find((o) => o.value === selectedValues[0]);
        return found ? found.label : `${selectedValues.length} selected`;
      }
      return `${selectedValues.length} items selected`;
    }
    const found = options.find((o) => o.value === selectedValues[0]);
    return found ? found.label : null;
  }, [selectedValues, options, multiple]);

  const handleOpen = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleSelect = (optionValue: T) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (multiple) {
      const exists = selectedValues.includes(optionValue);
      const nextValues = exists
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(nextValues);
    } else {
      onChange(optionValue);
      setModalVisible(false);
    }
  };

  const borderColor = error ? colors.danger : colors.border;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Label style={styles.label}>{label}</Label>}

      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        style={[
          styles.trigger,
          {
            borderColor,
            backgroundColor: colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <BlurView
          intensity={30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        <Typography
          variant="body"
          color={displayLabel ? 'text' : 'textSubtle'}
          style={styles.triggerText}
          numberOfLines={1}
        >
          {displayLabel ?? placeholder}
        </Typography>

        <Icon name="chevron-down" size="sm" color="textSubtle" />
      </Pressable>

      {error ? (
        <Typography variant="bodySmall" color="danger" style={styles.errorText}>
          {error}
        </Typography>
      ) : null}

      {/* Dropdown Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
          />

          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <SafeAreaView style={styles.sheetContent}>
              {/* Sheet Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderTitleRow}>
                  <Typography variant="h3" color="text">
                    {label ?? placeholder}
                  </Typography>
                  <Pressable
                    onPress={() => setModalVisible(false)}
                    hitSlop={8}
                    style={styles.closeBtn}
                  >
                    <Icon name="close" size="sm" color="textMuted" />
                  </Pressable>
                </View>

                {searchable && (
                  <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={searchPlaceholder}
                    containerStyle={styles.searchInput}
                  />
                )}
              </View>

              {/* Options List */}
              <FlatList
                data={filteredOptions}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isSelected = selectedValues.includes(item.value);
                  return (
                    <Pressable
                      onPress={() => handleSelect(item.value)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? colors.accentMuted
                            : pressed
                            ? colors.surfaceMuted
                            : 'transparent',
                        },
                      ]}
                    >
                      {item.icon && (
                        <Icon
                          name={item.icon}
                          size="md"
                          color={isSelected ? 'accent' : 'textMuted'}
                          style={styles.optionIcon}
                        />
                      )}

                      <View style={styles.optionDetails}>
                        <Typography
                          variant="body"
                          color={isSelected ? 'accent' : 'text'}
                          style={isSelected ? styles.selectedLabel : undefined}
                        >
                          {item.label}
                        </Typography>
                        {item.subtitle && (
                          <Typography variant="caption" color="textSubtle">
                            {item.subtitle}
                          </Typography>
                        )}
                      </View>

                      {isSelected && (
                        <Icon name="check" size="sm" color="accent" />
                      )}
                    </Pressable>
                  );
                }}
              />

              {multiple && (
                <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
                  <Pressable
                    onPress={() => setModalVisible(false)}
                    style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                  >
                    <Typography variant="button" color="primaryText">
                      Done
                    </Typography>
                  </Pressable>
                </View>
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    width: '100%',
  },
  label: {
    marginBottom: 2,
  },
  trigger: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  triggerText: {
    flex: 1,
    marginRight: 8,
  },
  errorText: {
    fontSize: 11,
    paddingHorizontal: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  sheetContent: {
    maxHeight: '100%',
  },
  sheetHeader: {
    padding: 16,
    gap: 12,
  },
  sheetHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    padding: 4,
  },
  searchInput: {
    marginTop: 4,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 2,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionDetails: {
    flex: 1,
    gap: 2,
  },
  selectedLabel: {
    fontWeight: '600',
  },
  sheetFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  doneBtn: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


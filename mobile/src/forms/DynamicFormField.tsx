import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Typography } from '../typography/Typography';
import { Checkbox } from './Checkbox';
import { Select } from './Select';
import { TextArea } from './TextArea';
import { TextInput } from './TextInput';
import type { FormField } from '../api/types';
import type { UploadedFormFile } from '../repositories/RegistrationRepository';

export type FormValues = Record<string, unknown>;

/** Applies a field's `visible_if` rule against the current answers. */
export function isFieldVisible(field: FormField, values: FormValues): boolean {
  if (field.admin_only) return false;
  const rule = field.visible_if;
  if (!rule) return true;
  const actual = values[rule.field_key];
  switch (rule.op) {
    case 'eq':
      return actual === rule.value;
    case 'neq':
      return actual !== rule.value;
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(actual as never);
    default:
      return true;
  }
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Client-side mirror of the backend form engine rules. Returns a message or undefined. */
export function validateField(field: FormField, value: unknown, file?: UploadedFormFile): string | undefined {
  if (field.type === 'file') {
    return field.required && !file ? 'Please upload a file.' : undefined;
  }
  if (field.type === 'checkbox') {
    return field.required && value !== true ? 'Please tick this box to continue.' : undefined;
  }
  if (isEmpty(value)) {
    return field.required ? 'This field is required.' : undefined;
  }

  const v = field.validation;
  const text = typeof value === 'string' ? value.trim() : '';

  switch (field.type) {
    case 'number': {
      const n = Number(text);
      if (!Number.isFinite(n)) return 'Enter a valid number.';
      if (v?.min != null && n < v.min) return `Must be at least ${v.min}.`;
      if (v?.max != null && n > v.max) return `Must be at most ${v.max}.`;
      return undefined;
    }
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Enter a valid email address.';
      break;
    case 'phone':
      if (!/^\+?[\d\s()-]{7,20}$/.test(text)) return 'Enter a valid phone number.';
      break;
    case 'url':
      if (!/^https?:\/\/\S+$/i.test(text)) return 'Enter a full link starting with https://';
      break;
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) return 'Use the format YYYY-MM-DD.';
      break;
    case 'user_ref':
      if (!/^[0-9a-f-]{36}$/i.test(text)) return 'Enter a valid member ID.';
      break;
  }

  if (['short_text', 'long_text', 'email', 'phone', 'url'].includes(field.type)) {
    if (v?.min != null && text.length < v.min) return `Must be at least ${v.min} characters.`;
    if (v?.max != null && text.length > v.max) return `Must be at most ${v.max} characters.`;
    if (v?.pattern) {
      try {
        if (!new RegExp(v.pattern).test(text)) return 'This value is not in the expected format.';
      } catch {
        // Ignore invalid patterns — the server remains the source of truth.
      }
    }
  }
  return undefined;
}

/** Converts edited values into the types the backend expects. */
export function serializeAnswer(field: FormField, value: unknown): unknown {
  if (isEmpty(value)) return undefined;
  if (field.type === 'number') return Number(String(value).trim());
  if (typeof value === 'string') return value.trim();
  return value;
}

export interface DynamicFormFieldProps {
  field: FormField;
  value: unknown;
  error?: string;
  file?: UploadedFormFile;
  onChange: (value: unknown) => void;
  onUploadFile?: (asset: { uri: string; name: string; mimeType: string }) => Promise<void>;
}

const KEYBOARD: Partial<Record<FormField['type'], 'email-address' | 'phone-pad' | 'url' | 'numeric'>> = {
  email: 'email-address',
  phone: 'phone-pad',
  url: 'url',
  number: 'numeric',
};

/** Renders one field of an admin-built registration form with the shared form controls. */
export function DynamicFormField({ field, value, error, file, onChange, onUploadFile }: DynamicFormFieldProps) {
  const [uploading, setUploading] = useState(false);
  const label = `${field.label.toUpperCase()}${field.required ? ' *' : ''}`;
  const helper = field.help_text ?? undefined;

  switch (field.type) {
    case 'long_text':
      return (
        <TextArea
          label={label}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={field.placeholder ?? undefined}
          maxLength={field.validation?.max ?? undefined}
          showCharCount={field.validation?.max != null}
          helperText={helper}
          error={error}
        />
      );

    case 'select':
    case 'multi_select':
      return (
        <Select
          label={label}
          placeholder={field.placeholder ?? 'Choose an option'}
          options={(field.options ?? []).map((o) => ({ label: o.label, value: o.value }))}
          value={value as string | string[] | undefined}
          multiple={field.type === 'multi_select'}
          searchable={(field.options?.length ?? 0) > 8}
          onChange={(next) => onChange(next)}
          error={error}
        />
      );

    case 'checkbox':
      return (
        <View style={styles.group}>
          <Checkbox checked={value === true} onChange={onChange} label={field.label} subtitle={helper} />
          {error ? <Typography variant="bodySmall" color="danger">{error}</Typography> : null}
        </View>
      );

    case 'file': {
      const pick = async () => {
        if (!onUploadFile) return;
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        setUploading(true);
        try {
          await onUploadFile({
            uri: asset.uri,
            name: asset.fileName ?? `${field.key}.jpg`,
            mimeType: asset.mimeType ?? 'image/jpeg',
          });
        } finally {
          setUploading(false);
        }
      };
      return (
        <Card variant="inner">
          <Typography variant="label" color="textMuted">{label}</Typography>
          {helper ? <Typography variant="caption" color="textMuted">{helper}</Typography> : null}
          <Typography variant="body" color={file ? 'success' : 'textMuted'}>
            {file ? `Uploaded: ${file.name ?? 'file'}` : 'Image up to 10MB (JPG, PNG or WEBP).'}
          </Typography>
          <Button
            label={file ? 'Replace file' : 'Upload image'}
            size="sm"
            variant="outline"
            leftIcon="image"
            loading={uploading}
            onPress={() => void pick()}
          />
          {error ? <Typography variant="bodySmall" color="danger">{error}</Typography> : null}
        </Card>
      );
    }

    default:
      return (
        <TextInput
          label={label}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={field.placeholder ?? (field.type === 'date' ? 'YYYY-MM-DD' : undefined)}
          keyboardType={KEYBOARD[field.type]}
          autoCapitalize={['email', 'url', 'user_ref'].includes(field.type) ? 'none' : 'sentences'}
          helperText={helper}
          error={error}
        />
      );
  }
}

const styles = StyleSheet.create({
  group: { gap: 6 },
});

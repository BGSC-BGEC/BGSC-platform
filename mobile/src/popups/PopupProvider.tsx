import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { PopupShell, type PopupTone } from './PopupShell';

export interface PopupOptions {
  title: string;
  message?: string;
  tone?: PopupTone;
  confirmLabel?: string;
  /** When set, a secondary cancel button is shown and the popup resolves false on cancel */
  cancelLabel?: string;
  /** Renders the confirm button in red for destructive actions (delete, logout, ...) */
  destructive?: boolean;
}

interface PopupContextValue {
  show: (options: PopupOptions) => Promise<boolean>;
}

const PopupContext = createContext<PopupContextValue | null>(null);

/**
 * Hosts a single app-wide popup. Screens call `usePopup()` and await the result:
 *
 *   const popup = usePopup();
 *   if (await popup.confirm({ title: 'Log out?', destructive: true })) { ... }
 */
export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<PopupOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const show = useCallback((next: PopupOptions) => {
    // A new popup replaces any open one; the previous caller is resolved as dismissed.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <PopupContext.Provider value={value}>
      {children}
      <PopupShell
        visible={options !== null}
        onRequestClose={() => close(false)}
        title={options?.title ?? ''}
        message={options?.message}
        tone={options?.tone}
      >
        <View style={styles.actions}>
          <Button
            label={options?.confirmLabel ?? 'OK'}
            variant={options?.destructive ? 'destructive' : 'primary'}
            fullWidth
            onPress={() => close(true)}
          />
          {options?.cancelLabel ? (
            <Button label={options.cancelLabel} variant="ghost" fullWidth onPress={() => close(false)} />
          ) : null}
        </View>
      </PopupShell>
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const ctx = useContext(PopupContext);
  if (!ctx) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  const { show } = ctx;

  return useMemo(
    () => ({
      show,
      success: (title: string, message?: string) => show({ title, message, tone: 'success', confirmLabel: 'Done' }),
      error: (title: string, message?: string) => show({ title, message, tone: 'error', confirmLabel: 'OK' }),
      info: (title: string, message?: string) => show({ title, message, tone: 'info', confirmLabel: 'Got it' }),
      warning: (title: string, message?: string) => show({ title, message, tone: 'warning', confirmLabel: 'OK' }),
      confirm: (opts: Omit<PopupOptions, 'cancelLabel'> & { cancelLabel?: string }) =>
        show({
          tone: opts.destructive ? 'error' : 'primary',
          confirmLabel: 'Confirm',
          ...opts,
          cancelLabel: opts.cancelLabel ?? 'Cancel',
        }),
    }),
    [show],
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
});

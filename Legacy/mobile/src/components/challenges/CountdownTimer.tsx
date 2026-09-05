import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface CountdownTimerProps {
  deadline: string | Date | null;
  style?: object;
}

/**
 * Deadline countdown (impl guide §7 / points spec §8.1): JetBrains Mono,
 * `N days N hours` or `HH:MM:SS`, hidden when >72 h remain, red inside the
 * last hour. Renders null when there is no deadline or it has passed.
 */
export function CountdownTimer({ deadline, style }: CountdownTimerProps) {
  const colors = useColors();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const totalSeconds = Math.max(
    0,
    Math.floor((new Date(deadline).getTime() - now) / 1000),
  );
  if (totalSeconds <= 0) return null;
  if (totalSeconds > 72 * 3600) return null; // hidden > 72 h

  const isUrgent = totalSeconds < 3600;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const label =
    days > 0
      ? `${days}d ${hours}h`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <Text
      style={[
        styles.timer,
        style,
        { color: isUrgent ? colors.danger : colors.textMuted },
      ]}
    >
      ⏱ {label}
    </Text>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

const styles = StyleSheet.create({
  timer: {
    fontFamily: FONTS.mono,
    fontSize: 13,
  },
});

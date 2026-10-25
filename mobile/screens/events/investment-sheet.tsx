import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { TextInput } from '../../src/forms/TextInput';
import { Alert } from '../../src/feedback/Alert';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import { investmentRepository, type InvestmentRequest } from '../../src/repositories/InvestmentRepository';
import { investmentLimit, validInvestment } from '../../src/repositories/investmentRules';
import { ApiError, getErrorMessage } from '../../src/api/client';

export default function InvestmentSheet({ visible, onClose, onInvested, eventId, title, userId, invested, cap }: {
  visible: boolean; onClose: () => void; onInvested: () => void; eventId: string; title: string;
  userId: string; invested: number; cap?: number | null;
}) {
  const { colors } = useTheme();
  const [amount, setAmount] = useState('10');
  const [previewAmount, setPreviewAmount] = useState(10);
  const [pending, setPending] = useState<InvestmentRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const submitting = useRef(false);
  const wallet = useAsyncResource(async () => {
    const [balance, request] = await Promise.all([pointsRepository.me(), investmentRepository.pending(userId, eventId)]);
    setPending(request);
    if (request) setAmount(String(request.amount));
    return balance;
  }, [visible, userId, eventId], { enabled: visible });
  const maximum = investmentLimit(wallet.data?.balance ?? 0, invested, cap);
  const valid = validInvestment(amount, maximum);
  const numericAmount = Number.isFinite(Number(amount)) ? Math.max(10, Math.min(maximum || 10, Math.round(Number(amount)))) : 10;
  const sliderRatio = maximum > 10 ? Math.max(0, Math.min(1, (numericAmount - 10) / (maximum - 10))) : 0;

  const stepAmount = (delta: number) => {
    if (busy || pending || maximum < 10) return;
    const next = Math.max(10, Math.min(maximum, (Number.isFinite(Number(amount)) ? Number(amount) : 10) + delta));
    setAmount(String(next));
  };

  useEffect(() => {
    const timer = setTimeout(() => setPreviewAmount(Number(amount)), 300);
    return () => clearTimeout(timer);
  }, [amount]);
  const projection = useAsyncResource(() => investmentRepository.project(eventId, previewAmount), [eventId, previewAmount],
    { enabled: visible && !pending && valid && Number(amount) === previewAmount });

  async function submit() {
    if (submitting.current || (!pending && !valid)) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const request = pending ?? await investmentRepository.prepare(userId, eventId, Number(amount));
      setPending(request);
      await investmentRepository.invest(eventId, request);
      await investmentRepository.clear(userId, eventId);
      setPending(null);
      onInvested();
      onClose();
    } catch (err) {
      const definite = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.code !== 'investment_in_flight';
      if (definite) {
        try { await investmentRepository.clear(userId, eventId); setPending(null); }
        catch { /* Keep the same request if durable cleanup fails. */ }
      }
      const messages: Record<string, string> = {
        insufficient_points: 'Your balance has changed. Refresh and try a smaller amount.',
        investment_cap_exceeded: 'This entry has reached its investment cap.',
        leaderboard_frozen: 'Results are frozen. This board no longer accepts points.',
        event_not_ongoing: 'Investments are only open while the event is ongoing.',
        entry_eliminated: 'Eliminated entries cannot receive investments.',
        investment_disabled: 'Investments are disabled for this event.',
      };
      setError(definite ? (messages[(err as ApiError).code] ?? getErrorMessage(err)) : 'We could not confirm the result. Retry this same request to check it without spending twice.');
    } finally { submitting.current = false; setBusy(false); }
  }

  return <BottomSheet visible={visible} onClose={() => { if (!busy) onClose(); }} dismissOnBackdrop={!busy} style={{ maxHeight: '90%' }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
      <Typography variant="caption" color="textMuted">INVEST IN {title.toUpperCase()}</Typography>
      <Typography variant="displayTitle">How many points?</Typography>
      {wallet.loading ? <Skeleton.Card /> : wallet.error ? <Alert variant="error" title="Could not load your balance" description={wallet.error} /> : <>
        <TextInput label="Points" value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={6} disabled={busy || !!pending}
          helperText={pending ? 'Your previous request is saved. Retry to confirm its result.' : `Minimum 10 · maximum ${maximum} · balance ${wallet.data?.balance ?? 0}`}
          error={!pending && !valid ? (maximum < 10 ? 'Not enough balance or investment allowance.' : `Enter a whole number from 10 to ${maximum}.`) : undefined} />
        {!pending && maximum >= 10 && (
          <View style={styles.sliderSection}>
            <View style={styles.stepperRow}>
              <Button label="-10" size="sm" variant="outline" disabled={busy || numericAmount <= 10} onPress={() => stepAmount(-10)} />
              <Pressable
                disabled={busy || maximum <= 10}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                onPress={(e) => {
                  if (trackWidth <= 0 || maximum <= 10) return;
                  const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth));
                  const picked = Math.round(10 + ratio * (maximum - 10));
                  setAmount(String(picked));
                }}
                accessibilityRole="adjustable"
                accessibilityLabel="Points investment range"
                style={[styles.sliderTrack, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}
              >
                <View style={[styles.sliderFill, { width: `${Math.round(sliderRatio * 100)}%`, backgroundColor: colors.primary }]} />
              </Pressable>
              <Button label="+10" size="sm" variant="outline" disabled={busy || numericAmount >= maximum} onPress={() => stepAmount(10)} />
            </View>
            <View style={styles.presetRow}>
              {[...new Set([10, 25, 50, maximum])].filter(n => n >= 10 && n <= maximum).map(n => (
                <Button key={n} label={n === maximum && n > 50 ? `Max (${n})` : String(n)} size="sm" variant={Number(amount) === n ? 'primary' : 'secondary'} onPress={() => setAmount(String(n))} disabled={busy} />
              ))}
            </View>
          </View>
        )}
        {!pending && valid && <Card variant="accent">
          <Typography variant="caption" color="textMuted">CURRENT → PROJECTED RANK</Typography>
          {projection.loading || previewAmount !== Number(amount) ? <Skeleton height={32} /> : projection.error ? <Alert variant="error" title="Projection unavailable" description={projection.error} /> : <>
            <Typography variant="displayTitle" numberOfLines={1}>
              {projection.data?.current_rank ? `#${projection.data.current_rank}` : '—'} → {projection.data?.projected_rank ? `#${projection.data.projected_rank}` : 'Unranked'}
            </Typography>
            <Typography variant="caption">Balance after: {(wallet.data?.balance ?? 0) - Number(amount)} points</Typography>
            <Typography variant="caption" color="textMuted">Projection is an estimate. Final ranks can change.</Typography>
          </>}
        </Card>}
        {error && <Alert variant="error" title="Investment not confirmed" description={error} />}
        <Typography variant="caption" color="textMuted">Points are spent on your own entry or team. Confirm the amount before investing.</Typography>
        <Button label={pending ? 'Retry saved investment' : `Invest ${valid ? amount : '…'} points`} onPress={() => void submit()} loading={busy} disabled={!pending && (!valid || projection.loading || !!projection.error || projection.data?.amount !== Number(amount))} />
      </>}
      <Button label="Cancel" variant="outline" disabled={busy} onPress={onClose} />
    </ScrollView>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  sliderSection: { gap: 10 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderTrack: { flex: 1, height: 14, borderRadius: 999, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  sliderFill: { height: '100%', borderRadius: 999 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

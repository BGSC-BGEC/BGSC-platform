import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MOCK_PLAYER_AUCTION, type AuctionBid } from '../../src/mock/player-auction';

export default function Auction() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [secondsRemaining, setSecondsRemaining] = useState(MOCK_PLAYER_AUCTION.secondsRemaining);
  const [bids] = useState<AuctionBid[]>(MOCK_PLAYER_AUCTION.bids);
  const [sold] = useState(false);
  const player = useMemo(
    () => MOCK_PLAYER_AUCTION.players.find((item) => item.id === MOCK_PLAYER_AUCTION.currentPlayerId)!,
    [],
  );

  useEffect(() => {
    if (secondsRemaining <= 0 || sold) return;
    const timer = setInterval(() => setSecondsRemaining((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining, sold]);

  const currentBid = bids[0]?.amount ?? player.basePrice;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Live auction" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.accentMuted }]}>
          <Badge label={sold ? 'Sold' : secondsRemaining > 0 ? 'Live now' : 'Bid closed'} variant={sold ? 'primary' : secondsRemaining > 0 ? 'success' : 'warning'} />
          <Typography variant="displayTitle">{MOCK_PLAYER_AUCTION.title}</Typography>
          <Typography variant="body" color="textMuted">The admin is currently presenting registered players to approved team captains.</Typography>
        </View>

        <Card variant="accent">
          <Card.Header title="Currently on the block" rightAction={<Typography variant="h2" color="accent">{secondsRemaining}s</Typography>} />
          <Card.Body>
            <Typography variant="displayTitle">{player.name}</Typography>
            <Typography variant="body" color="textMuted">{player.role} · Base price {player.basePrice} credits</Typography>
            <View style={styles.currentBid}>
              <Typography variant="caption" color="textMuted">CURRENT BID</Typography>
              <Typography variant="h1" color="accent">{currentBid} credits</Typography>
              <Typography variant="body" color="textMuted">{bids[0]?.team ?? 'Waiting for the first bid'}</Typography>
            </View>
          </Card.Body>
        </Card>

        <Card variant="solid">
          <Card.Header title="Live bid log" rightAction={<Badge label={`${bids.length} bids`} variant="slate" />} />
          {bids.map((bid) => (
            <View key={bid.id} style={[styles.bidRow, { borderBottomColor: colors.border }]}>
              <View>
                <Typography variant="body">{bid.team}</Typography>
                <Typography variant="caption" color="textMuted">Captain {bid.captain} · {bid.timeLabel}</Typography>
              </View>
              <Typography variant="h3" color="accent">{bid.amount} credits</Typography>
            </View>
          ))}
        </Card>

        <Card variant="solid">
          <Card.Header title="Captain wallets" />
          {MOCK_PLAYER_AUCTION.captains.map((captain) => (
            <View key={captain.team} style={styles.walletRow}>
              <Typography variant="body">{captain.team}</Typography>
              <Typography variant="caption" color="textMuted">{captain.purse - captain.spent} credits left</Typography>
            </View>
          ))}
        </Card>

        <Button label="Open admin auction controls" variant="outline" fullWidth onPress={() => navigation.navigate('AuctionConsole')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 20, borderRadius: 24, gap: 10 },
  currentBid: { gap: 4, marginTop: 18 },
  bidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
});

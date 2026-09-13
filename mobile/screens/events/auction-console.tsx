import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MOCK_PLAYER_AUCTION } from '../../src/mock/player-auction';

export default function AuctionConsole() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<'Ready' | 'Live' | 'Closed' | 'Sold' | 'Unsold'>('Live');
  const player = MOCK_PLAYER_AUCTION.players[0];
  const latestBid = MOCK_PLAYER_AUCTION.bids[0];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Auction controls" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <Typography variant="displayTitle">Admin live console</Typography>
        <Typography variant="body" color="textMuted">Control the player currently shown to spectators and captains.</Typography>
        <Card variant="accent">
          <Card.Header title="Current player" rightAction={<Badge label={status} variant={status === 'Live' ? 'success' : 'warning'} />} />
          <Card.Body>
            <Typography variant="h1">{player.name}</Typography>
            <Typography variant="body" color="textMuted">{player.role} · Base price {player.basePrice} credits</Typography>
            <Typography variant="h2" color="accent" style={styles.price}>{latestBid.amount} credits</Typography>
            <Typography variant="caption" color="textMuted">Latest bid by {latestBid.captain} for {latestBid.team}</Typography>
          </Card.Body>
        </Card>
        <Card variant="solid">
          <Card.Header title="Live controls" />
          <View style={styles.controls}>
            <Button label="Start auction block" size="sm" variant="outline" onPress={() => setStatus('Live')} />
            <Button label="Close bidding" size="sm" variant="outline" onPress={() => setStatus('Closed')} />
            <Button label="Mark sold" size="sm" onPress={() => setStatus('Sold')} />
            <Button label="Mark unsold" size="sm" variant="destructive" onPress={() => setStatus('Unsold')} />
          </View>
        </Card>
        <Button label="Back to live view" variant="ghost" fullWidth onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  price: { marginTop: 18 },
  controls: { gap: 10 },
});

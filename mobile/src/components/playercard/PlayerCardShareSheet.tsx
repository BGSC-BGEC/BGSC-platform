import React, { useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { Typography } from '../../typography/Typography';
import { usePopup } from '../../popups/PopupProvider';
import { getErrorMessage } from '../../api/client';
import { PlayerCardView, type PlayerCardViewProps } from './PlayerCardView';

/**
 * Preview of the player card with a "Share image" action: the card is captured to a PNG with
 * react-native-view-shot and handed to the system share sheet. Where image sharing isn't
 * available (e.g. web), it falls back to sharing the text summary.
 */
export function PlayerCardShareSheet({
  visible,
  onClose,
  card,
}: {
  visible: boolean;
  onClose: () => void;
  card: PlayerCardViewProps;
}) {
  const popup = usePopup();
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);

  const summary = `${card.fullName} (@${card.username}) · ${card.tier} · BGSC rating ${card.rating}`;

  const share = async () => {
    setBusy(true);
    try {
      if (cardRef.current && (await Sharing.isAvailableAsync())) {
        // 3x so the shared PNG stays sharp in chats and stories.
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 900 });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share player card', UTI: 'public.png' });
      } else {
        await Share.share({ message: summary });
      }
    } catch (err) {
      popup.error('Could not share', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Typography variant="h2" style={styles.title}>
        Your Player Card
      </Typography>
      <View style={styles.cardWrap}>
        {/* collapsable={false}: Android must keep this view so view-shot can capture it. */}
        <View ref={cardRef} collapsable={false} style={styles.capture}>
          <PlayerCardView {...card} />
        </View>
      </View>
      <Button label="Share image" leftIcon="share" loading={busy} onPress={() => void share()} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 12,
  },
  cardWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  capture: {
    // Transparent corners around the rounded card in the exported PNG.
    backgroundColor: 'transparent',
  },
});

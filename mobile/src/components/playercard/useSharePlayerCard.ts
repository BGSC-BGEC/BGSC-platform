import React, { useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { usePopup } from '../../popups/PopupProvider';
import { getErrorMessage } from '../../api/client';

/**
 * Shares the card exactly as it's drawn on screen: `cardRef` points at the card view, which is
 * captured to a PNG with react-native-view-shot and handed to the system share sheet. Where image
 * sharing isn't available (e.g. web), it falls back to sharing `summary` as text.
 *
 * The ref must sit on an unscaled 300×480 view with `collapsable={false}` (Android drops it
 * otherwise).
 */
export function useSharePlayerCard(cardRef: React.RefObject<React.ComponentRef<typeof View> | null>, summary: string) {
  const popup = usePopup();
  const [sharing, setSharing] = useState(false);

  const share = useCallback(async () => {
    setSharing(true);
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
      setSharing(false);
    }
  }, [cardRef, summary, popup]);

  return { share, sharing };
}

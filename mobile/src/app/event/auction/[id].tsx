import { useLocalSearchParams } from 'expo-router';

import { AuctionView } from '@/components/events/AuctionView';
import { RouteHeader } from '@/components/events/RouteHeader';
import { Screen } from '@/components/screen';
import { useEventDetail } from '@/hooks/use-events';

/**
 * Auction spectator sub-route (events-page1.md §9), pushed from event
 * details for auction-based leagues. Spectators only — no bidding controls.
 */
export default function EventAuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = String(id);
  const { data: event, isLoading, isError, refetch } = useEventDetail(eventId);

  return (
    <Screen>
      <RouteHeader title={`Auction — ${event?.title ?? '…'}`} />
      <AuctionView
        event={event}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />
    </Screen>
  );
}

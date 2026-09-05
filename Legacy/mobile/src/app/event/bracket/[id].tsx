import { useLocalSearchParams } from 'expo-router';

import { BracketView } from '@/components/events/BracketView';
import { RouteHeader } from '@/components/events/RouteHeader';
import { Screen } from '@/components/screen';
import { useEventDetail } from '@/hooks/use-events';

/**
 * Spectator bracket sub-route (events-page1.md §8), pushed from event
 * details when the event has a bracket.
 */
export default function EventBracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = String(id);
  const { data: event, isLoading, isError, refetch } = useEventDetail(eventId);

  return (
    <Screen>
      <RouteHeader title={`Bracket — ${event?.title ?? '…'}`} />
      <BracketView
        event={event}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />
    </Screen>
  );
}

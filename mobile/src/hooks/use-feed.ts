import { useQuery } from '@tanstack/react-query';

import { MOCK_FEED_POSTS } from '@/components/home/mock-feed';
import type { FeedPost } from '@/components/home/types';

/**
 * Social feed (home-page.md H5). The feed service is Phase 2 — there is no
 * repository or backend endpoint yet, so this serves local mock data.
 *
 * TODO(phase2): replace the mock path with a FeedRepository + real query
 * once the social feed service lands. Expected contract: newest-first list
 * of public posts, query key ['feed', 'posts'].
 */
export function useFeed() {
  return useQuery({
    queryKey: ['feed', 'posts'],
    queryFn: async (): Promise<FeedPost[]> => {
      // Small delay so the shape-matched skeletons are visible on fast machines.
      await new Promise((resolve) => setTimeout(resolve, 450));
      return MOCK_FEED_POSTS;
    },
    staleTime: 60_000,
  });
}

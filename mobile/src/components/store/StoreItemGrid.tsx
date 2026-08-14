import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState, SectionError } from '@/components/home/StateViews';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { StoreItemCard } from '@/components/store/StoreItemCard';
import type { StoreItem } from '@/core/types';

export interface StoreItemGridProps {
  items?: StoreItem[];
  isLoading: boolean;
  isError: boolean;
  cart: Record<string, number>;
  onAdd: (item: StoreItem) => void;
  onRetry: () => void;
}

/**
 * Merchandise grid (store spec §2.2, 2 columns) with full state coverage:
 * 2-col skeleton grid while loading, retry card on error, and the spec §8
 * empty copy ("Store is currently empty. Check back later!").
 */
export function StoreItemGrid({ items, isLoading, isError, cart, onAdd, onRetry }: StoreItemGridProps) {
  if (isLoading) return <GridSkeleton />;
  if (isError) return <SectionError message="Could not load the store" onRetry={onRetry} />;

  const data = items ?? [];
  if (data.length === 0) {
    return (
      <EmptyState
        icon="bag-outline"
        title="Store is currently empty."
        message="Check back later!"
      />
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      numColumns={2}
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <StoreItemCard item={item} cartQty={cart[item.id] ?? 0} onAdd={onAdd} />
      )}
    />
  );
}

function GridSkeleton() {
  return (
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonBlock key={i} height={252} radius={16} style={styles.skeletonCell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
  },
  row: {
    gap: 12,
  },
  skeletonCell: {
    flex: 1,
  },
});

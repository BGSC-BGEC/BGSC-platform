import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { EmptyState, SectionError } from '@/components/home/StateViews';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import type { StoreOrder, StoreOrderStatus } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { formatDateTime } from '@/lib/dates';

const STATUS_LABEL: Record<StoreOrderStatus, string> = {
  placed: 'Placed',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export interface OrderHistorySectionProps {
  orders?: StoreOrder[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * Order history (store spec §2.2 "Track My Orders"): fulfilment status,
 * line items and total per order. Skeleton rows while loading, retry on
 * error, and the spec §8 empty copy ("No orders yet...").
 */
export function OrderHistorySection({ orders, isLoading, isError, onRetry }: OrderHistorySectionProps) {
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={styles.stack}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={120} radius={16} />
        ))}
      </View>
    );
  }
  if (isError) return <SectionError message="Could not load your orders" onRetry={onRetry} />;

  const data = orders ?? [];
  if (data.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="No orders yet"
        message="Redeem your first item and track it here."
      />
    );
  }

  return (
    <View style={styles.stack}>
      {data.map((order) => {
        const statusColor =
          order.status === 'fulfilled'
            ? colors.success
            : order.status === 'cancelled'
              ? colors.danger
              : colors.info;
        return (
          <GlassCard key={order.id} accessibilityLabel={`Order ${order.id}`}>
            <View style={styles.headRow}>
              <Text style={[styles.orderId, { color: colors.textMuted }]}>
                #{order.id.replace(/^ord_/, '').toUpperCase()}
              </Text>
              <View style={[styles.statusPill, { borderColor: statusColor }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {STATUS_LABEL[order.status]}
                </Text>
              </View>
            </View>
            <Text style={[styles.date, { color: colors.textMuted }]}>
              {formatDateTime(order.createdAt)}
            </Text>
            <View style={styles.items}>
              {order.items.map((line) => (
                <Text key={line.itemId} style={[styles.itemLine, { color: colors.textMuted }]}>
                  {line.quantity}× {line.title}
                </Text>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
              <Text style={[styles.total, { color: colors.text }]}>
                {order.totalPoints.toLocaleString()} pts
              </Text>
            </View>
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  date: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
  },
  items: {
    gap: 2,
    marginTop: 10,
  },
  itemLine: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  totalLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  total: {
    fontFamily: FONTS.hero,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
});

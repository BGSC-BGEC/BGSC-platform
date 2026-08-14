import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthLocked } from '@/components/AuthLocked';
import { GlassCard } from '@/components/GlassCard';
import { CheckoutSheet } from '@/components/store/CheckoutSheet';
import { OrderHistorySection } from '@/components/store/OrderHistorySection';
import { StoreItemGrid } from '@/components/store/StoreItemGrid';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import type { RedemptionInput, StoreItem } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { usePointsBalance } from '@/hooks/use-points';
import { useRedeemStoreItems, useStoreItems, useStoreOrders } from '@/hooks/use-store';

/**
 * Store (master §9 / store-page.md). Auth required (master §2.4) — guests
 * get the locked state. Sections: balance + cart header, 2-col merchandise
 * grid, order history, then Phase 2 stubs for the spec §3-5 sections.
 *
 * Redemption (store spec §6.1): cart is local UI state; the checkout bottom
 * sheet has a confirm step; the mutation invalidates ['store'] and
 * ['points','balance'] on success (master §12.3).
 */
export default function StoreScreen() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  if (status === 'unknown' || status === 'loading') return <StoreSkeleton />;
  if (status !== 'authenticated') {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <AuthLocked subject="the store" />
      </View>
    );
  }

  return <StoreDashboard />;
}

function StoreDashboard() {
  const colors = useColors();
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id) ?? 'me';

  const balance = usePointsBalance(userId);
  const items = useStoreItems();
  const orders = useStoreOrders();
  const redeem = useRedeemStoreItems();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const ordersY = useRef(0);

  const itemsById = useMemo(() => {
    const map = new Map<string, StoreItem>();
    for (const item of items.data ?? []) map.set(item.id, item);
    return map;
  }, [items.data]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const item = itemsById.get(id);
          return item ? { item, quantity } : null;
        })
        .filter((l): l is { item: StoreItem; quantity: number } => l !== null),
    [cart, itemsById],
  );
  const cartCount = cartLines.reduce((n, l) => n + l.quantity, 0);

  const addToCart = (item: StoreItem) => {
    Haptics.selectionAsync();
    setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }));
  };

  const onConfirmRedemption = (input: RedemptionInput['items']) => {
    redeem.mutate(
      { items: input },
      {
        onSuccess: (order) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.show(`Order placed — ${order.totalPoints.toLocaleString()} pts redeemed!`);
          setCart({});
          setCheckoutOpen(false);
        },
        onError: (err) => {
          toast.show(err instanceof Error ? err.message : 'Could not place your order. Try again.');
        },
      },
    );
  };

  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BalanceCard
          balance={balance.data?.balance ?? 0}
          loading={balance.isPending}
          error={balance.isError ? 'Could not load balance' : null}
          onRetry={() => balance.refetch()}
        />

        <View style={styles.merchHeader}>
          <SectionHeading>Merchandise Store</SectionHeading>
          <Pressable
            onPress={() => setCheckoutOpen(true)}
            disabled={cartCount === 0}
            accessibilityRole="button"
            accessibilityLabel={`Open cart, ${cartCount} items`}
            accessibilityState={{ disabled: cartCount === 0 }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.cartButton,
              { opacity: pressed ? 0.8 : cartCount === 0 ? 0.4 : 1 },
            ]}
          >
            <Ionicons name="bag-outline" size={24} color={colors.text} />
            {cartCount > 0 ? (
              <View style={[styles.cartBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.cartBadgeText, { color: colors.accentText }]}>{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ y: ordersY.current, animated: true })}
          accessibilityRole="button"
          accessibilityLabel="Track my orders"
          hitSlop={8}
          style={styles.trackButton}
        >
          <Ionicons name="cube-outline" size={16} color={colors.accent} />
          <Text style={[styles.trackText, { color: colors.accent }]}>Track My Orders</Text>
        </Pressable>

        <StoreItemGrid
          items={items.data}
          isLoading={items.isPending}
          isError={items.isError}
          cart={cart}
          onAdd={addToCart}
          onRetry={() => items.refetch()}
        />

        <View
          onLayout={(e) => {
            ordersY.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeading>Order History</SectionHeading>
          <OrderHistorySection
            orders={orders.data}
            isLoading={orders.isPending}
            isError={orders.isError}
            onRetry={() => orders.refetch()}
          />
        </View>

        <Phase2Stubs />
      </ScrollView>

      <CheckoutSheet
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        lines={cartLines}
        balance={balance.data?.balance ?? 0}
        pending={redeem.isPending}
        onConfirm={onConfirmRedemption}
      />
    </View>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function BalanceCard({
  balance,
  loading,
  error,
  onRetry,
}: {
  balance: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <GlassCard accessibilityLabel="Points balance">
      <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Your Points</Text>
      {loading ? (
        <SkeletonBlock width={140} height={44} radius={8} style={styles.balanceSkeleton} />
      ) : error ? (
        <>
          <Text style={[styles.balanceError, { color: colors.textMuted }]}>{error}</Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading balance"
            hitSlop={8}
            style={styles.retry}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.balance, { color: colors.accent }]}>
          {balance.toLocaleString()} pts
        </Text>
      )}
    </GlassCard>
  );
}

function SectionHeading({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionHeading, { color: colors.text }]}>{children}</Text>;
}

/**
 * Spec §3-5 sections (Indie Game Showcase, Friendly Games Jam, Friendly
 * Gaming) are Phase 2 — no backend services exist for games, pitches, or
 * Discord/Steam OAuth. Stub cards so the sections are visible.
 * TODO(Phase 2): replace each stub with its full section per store-page.md.
 */
function Phase2Stubs() {
  const colors = useColors();
  const stubs = [
    { icon: 'game-controller-outline' as const, title: 'Indie Game Showcase', note: 'Game trailers & downloads' },
    { icon: 'bulb-outline' as const, title: 'Friendly Games Jam', note: 'Pitch board, upvotes & comments' },
    { icon: 'headset-outline' as const, title: 'Friendly Gaming', note: 'Discord / Steam linking & voice overlay' },
  ];
  return (
    <View style={styles.stubs}>
      {stubs.map((s) => (
        <GlassCard key={s.title} accessibilityLabel={`${s.title} — coming soon`}>
          <View style={styles.stubRow}>
            <Ionicons name={s.icon} size={20} color={colors.textMuted} />
            <View style={styles.stubCol}>
              <Text style={[styles.stubTitle, { color: colors.text }]}>{s.title}</Text>
              <Text style={[styles.stubNote, { color: colors.textMuted }]}>{s.note}</Text>
            </View>
            <View style={[styles.soonPill, { backgroundColor: colors.accentMuted }]}>
              <Text style={[styles.soonText, { color: colors.accent }]}>Coming Soon</Text>
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

/** Session-restore placeholder — skeletons only, never a spinner. */
function StoreSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.canvas, { backgroundColor: colors.background, padding: 16, gap: 12 }]}>
      <SkeletonBlock height={104} radius={16} />
      <SkeletonBlock width={180} height={22} radius={6} />
      <View style={styles.skeletonGrid}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} height={252} radius={16} style={styles.skeletonCell} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  balanceLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  balance: {
    fontFamily: FONTS.hero,
    fontSize: 44,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  balanceSkeleton: {
    marginTop: 8,
  },
  balanceError: {
    fontFamily: FONTS.body,
    fontSize: 14,
    marginTop: 8,
  },
  retry: {
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  merchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontFamily: FONTS.heading,
    fontSize: 24,
  },
  cartButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: -10,
  },
  trackText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  stubs: {
    gap: 12,
  },
  stubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stubCol: {
    flex: 1,
    gap: 2,
  },
  stubTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
  },
  stubNote: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  soonPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  soonText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonCell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
});

import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import type { StoreItem, StoreStockStatus } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const CATEGORY_EMOJI: Record<StoreItem['category'], string> = {
  merch: '🧢',
  game: '🎮',
};

const STOCK_LABEL: Record<StoreStockStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Sold Out',
};

export interface StoreItemCardProps {
  item: StoreItem;
  /** Quantity already in the local cart (badge on the artwork). */
  cartQty: number;
  onAdd: (item: StoreItem) => void;
}

/**
 * Store grid card (store spec §2.2): artwork, title, point cost in hero
 * numerals, stock status (dot + text — colour is never the only signal),
 * and an Add to Cart button that disables when out of stock.
 */
export function StoreItemCard({ item, cartQty, onAdd }: StoreItemCardProps) {
  const colors = useColors();
  const out = item.stock === 'out_of_stock';
  const stockColor =
    item.stock === 'in_stock'
      ? colors.success
      : item.stock === 'low_stock'
        ? colors.accent
        : colors.danger;

  return (
    <GlassCard style={styles.card} accessibilityLabel={`${item.title}, ${item.costPoints} points`}>
      <View style={[styles.art, { backgroundColor: colors.surfaceMuted }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.artEmoji}>{CATEGORY_EMOJI[item.category]}</Text>
        )}
        {cartQty > 0 ? (
          <View style={[styles.qtyBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.qtyBadgeText, { color: colors.accentText }]}>{cartQty}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.costRow}>
        <Text style={[styles.cost, { color: colors.text }]}>{item.costPoints.toLocaleString()}</Text>
        <Text style={[styles.costUnit, { color: colors.textMuted }]}>PTS</Text>
      </View>

      <View style={styles.stockRow}>
        <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
        <Text style={[styles.stockLabel, { color: colors.textMuted }]}>{STOCK_LABEL[item.stock]}</Text>
      </View>

      <PillButton
        label={out ? 'Out of Stock' : 'Add to Cart'}
        variant="primary"
        disabled={out}
        onPress={() => onAdd(item)}
        accessibilityLabel={out ? `${item.title} is out of stock` : `Add ${item.title} to cart`}
        style={styles.addButton}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 8,
  },
  art: {
    aspectRatio: 1.4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artEmoji: {
    fontSize: 44,
  },
  qtyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    minHeight: 38,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cost: {
    fontFamily: FONTS.hero,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  costUnit: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stockLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  addButton: {
    height: 44,
    paddingHorizontal: 12,
    marginTop: 2,
  },
});

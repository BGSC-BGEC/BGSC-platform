import type { RedemptionInput, StoreItem, StoreOrder } from '../types';

/**
 * Store domain repository (master §12.2).
 *
 * The store-service does not exist yet: points-service.md documents no store
 * routes, and the spend flow through the points ledger (type 'spend', source
 * 'store') is Phase 2 (master §13.3 / §15.5). Every method is therefore a
 * local mock behind the real repository surface — Phase 2 swaps the bodies
 * for `apiClient` calls without touching hooks or screens.
 *
 * TODO(Phase 2): wire to the store-service once it ships (POST /store/redemptions
 * writes the order + ledger spend atomically; GET /store/items + GET /store/orders
 * serve the catalog/history).
 */

const STORE_ITEMS_MOCK: StoreItem[] = [
  { id: 'item_tshirt', title: 'BGSC T-Shirt', description: 'Event-day classic. Cotton, unisex.', category: 'merch', costPoints: 500, stock: 'in_stock', imageUrl: null },
  { id: 'item_mug', title: 'Coffee Mug', description: 'Campus mornings, BGSC edition.', category: 'merch', costPoints: 250, stock: 'in_stock', imageUrl: null },
  { id: 'item_hoodie', title: 'Champions Hoodie', description: 'Heavyweight fleece, embroidered crest.', category: 'merch', costPoints: 800, stock: 'low_stock', imageUrl: null },
  { id: 'item_stickers', title: 'Sticker Pack', description: '9 die-cut stickers, one per society.', category: 'merch', costPoints: 100, stock: 'in_stock', imageUrl: null },
  { id: 'item_bottle', title: 'Steel Water Bottle', description: '500 ml insulated, matte teal.', category: 'merch', costPoints: 300, stock: 'low_stock', imageUrl: null },
  { id: 'item_cap', title: 'Snapback Cap', description: 'Embroidered BGSC logo, adjustable.', category: 'merch', costPoints: 450, stock: 'out_of_stock', imageUrl: null },
];

const STORE_ORDERS_MOCK: StoreOrder[] = [
  {
    id: 'ord_9f2c81ab',
    items: [{ itemId: 'item_tshirt', title: 'BGSC T-Shirt', quantity: 1, costPoints: 500 }],
    totalPoints: 500,
    status: 'fulfilled',
    createdAt: '2026-07-28T10:15:00.000Z',
  },
  {
    id: 'ord_3d17e0f2',
    items: [{ itemId: 'item_mug', title: 'Coffee Mug', quantity: 2, costPoints: 250 }],
    totalPoints: 500,
    status: 'placed',
    createdAt: '2026-08-06T16:40:00.000Z',
  },
];

export const StoreRepository = {
  /** TODO(Phase 2): `apiClient.get<StoreItem[]>('/store/items')`. */
  async listItems(): Promise<StoreItem[]> {
    return STORE_ITEMS_MOCK;
  },

  /** TODO(Phase 2): `apiClient.get<StoreOrder[]>('/store/orders')` (own orders). */
  async listOrders(): Promise<StoreOrder[]> {
    return STORE_ORDERS_MOCK;
  },

  /**
   * TODO(Phase 2): `apiClient.post<StoreOrder>('/store/redemptions', { body: input })`.
   * The server must validate stock + balance, then write the order and the
   * `spend` ledger row atomically. The mock simulates that latency but does
   * NOT touch the real balance — invalidation still refetches it (unchanged
   * until the backend lands).
   */
  async redeem(input: RedemptionInput): Promise<StoreOrder> {
    await delay(600);
    const lines = input.items.map(({ itemId, quantity }) => {
      const item = STORE_ITEMS_MOCK.find((i) => i.id === itemId);
      if (!item) throw new Error(`Unknown store item: ${itemId}`);
      return { itemId, title: item.title, quantity, costPoints: item.costPoints };
    });
    const order: StoreOrder = {
      id: `ord_${Date.now().toString(36)}`,
      items: lines,
      totalPoints: lines.reduce((sum, l) => sum + l.costPoints * l.quantity, 0),
      status: 'placed',
      createdAt: new Date().toISOString(),
    };
    STORE_ORDERS_MOCK.unshift(order);
    return order;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

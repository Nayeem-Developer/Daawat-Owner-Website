import {
  createInitialOwnerOrdersState,
  ownerOrdersReducer,
  shouldRefreshOrdersOnFocus,
} from '../orderStore';
import { matchesOrderFilter } from '../orderStatus';

const acceptedOrder = {
  _id: 'order-1',
  orderId: '1001',
  customerName: 'Test Customer',
  status: 'Accepted',
  orderStatus: 'Accepted',
  total: 250,
  items: [{ name: 'Biryani', quantity: 1, price: 250 }],
  createdAt: '2026-07-09T10:00:00.000Z',
  updatedAt: '2026-07-09T10:00:00.000Z',
};

const cancelledOrderUpdate = {
  _id: 'order-1',
  status: 'Cancelled',
  orderStatus: 'Cancelled',
  cancelledBy: 'customer',
  updatedAt: '2026-07-09T10:05:00.000Z',
};

describe('ownerOrdersReducer', () => {
  it('moves a cancelled order out of accepted and into cancelled immediately', () => {
    let state = ownerOrdersReducer(createInitialOwnerOrdersState(), {
      type: 'LOAD_SUCCESS',
      orders: [acceptedOrder],
      receivedAt: Date.now(),
    });

    state = ownerOrdersReducer(state, {
      type: 'UPSERT_ORDER',
      order: cancelledOrderUpdate,
      receivedAt: Date.now(),
    });

    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].status).toBe('Cancelled');
    expect(matchesOrderFilter(state.orders[0], 'Accepted')).toBe(false);
    expect(matchesOrderFilter(state.orders[0], 'Cancelled')).toBe(true);
  });

  it('does not duplicate an order when the same event arrives twice', () => {
    let state = ownerOrdersReducer(createInitialOwnerOrdersState(), {
      type: 'LOAD_SUCCESS',
      orders: [acceptedOrder],
      receivedAt: Date.now(),
    });

    state = ownerOrdersReducer(state, {
      type: 'UPSERT_ORDER',
      order: cancelledOrderUpdate,
      receivedAt: Date.now(),
    });

    state = ownerOrdersReducer(state, {
      type: 'UPSERT_ORDER',
      order: cancelledOrderUpdate,
      receivedAt: Date.now(),
    });

    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].status).toBe('Cancelled');
  });

  it('replaces stale local state when a 409 conflict returns the latest order', () => {
    let state = ownerOrdersReducer(createInitialOwnerOrdersState(), {
      type: 'LOAD_SUCCESS',
      orders: [acceptedOrder],
      receivedAt: Date.now(),
    });

    state = ownerOrdersReducer(state, {
      type: 'STATUS_ACTION_START',
      orderId: 'order-1',
      status: 'Out for Delivery',
    });

    state = ownerOrdersReducer(state, {
      type: 'UPSERT_ORDER',
      order: cancelledOrderUpdate,
      receivedAt: Date.now(),
    });

    state = ownerOrdersReducer(state, {
      type: 'STATUS_ACTION_FINISH',
      orderId: 'order-1',
    });

    expect(state.orders[0].status).toBe('Cancelled');
    expect(state.pendingActions['order-1']).toBeUndefined();
  });
});

describe('shouldRefreshOrdersOnFocus', () => {
  it('refreshes when the socket is disconnected or data is stale', () => {
    expect(
      shouldRefreshOrdersOnFocus({
        hasLoaded: true,
        isConnected: false,
        lastRefreshAt: Date.now(),
      }),
    ).toBe(true);

    expect(
      shouldRefreshOrdersOnFocus({
        hasLoaded: true,
        isConnected: true,
        lastRefreshAt: 1000,
        now: 50000,
        staleAfterMs: 10000,
      }),
    ).toBe(true);
  });

  it('skips focus refresh when realtime is connected and data is fresh', () => {
    expect(
      shouldRefreshOrdersOnFocus({
        hasLoaded: true,
        isConnected: true,
        lastRefreshAt: 45000,
        now: 50000,
        staleAfterMs: 10000,
      }),
    ).toBe(false);
  });
});

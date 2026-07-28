import { getOrderIdentifier, normalizeOrder } from './formatters';
import {
  isAcceptedOrderStatus,
  isCancelledOrderStatus,
  isPendingOrderStatus,
  isDeliveredOrderStatus,
  isOutForDeliveryStatus,
} from './orderStatus';

export const DEFAULT_OWNER_ORDER_LIMIT = 100;
export const ORDER_REFRESH_STALE_MS = 30000;

const getOrderSortTime = order => {
  const candidate =
    order?.updatedAt ||
    order?.createdAt ||
    order?.updated_at ||
    order?.created_at ||
    0;
  const timestamp = new Date(candidate).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const sortOrdersNewestFirst = orders =>
  [...orders].sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left));

export const dedupeOrders = (orders = []) => {
  const seen = new Set();
  const deduped = [];

  for (const rawOrder of sortOrdersNewestFirst(orders)) {
    const order = normalizeOrder(rawOrder);
    const orderId = getOrderIdentifier(order);

    if (!orderId || seen.has(orderId)) {
      continue;
    }

    seen.add(orderId);
    deduped.push(order);
  }

  return deduped;
};

export const mergeOrderIntoOrders = (orders = [], incomingOrder) => {
  const incomingId = getOrderIdentifier(incomingOrder);

  if (!incomingId) {
    return dedupeOrders(orders);
  }

  const existingOrder = orders.find(order => getOrderIdentifier(order) === incomingId);
  const mergedOrder = normalizeOrder({
    ...(existingOrder || {}),
    ...(incomingOrder || {}),
  });

  return dedupeOrders([
    ...orders.filter(order => getOrderIdentifier(order) !== incomingId),
    mergedOrder,
  ]);
};

export const buildOrderCounts = (orders = []) =>
  orders.reduce(
    (counts, order) => {
      counts.all += 1;

      if (isAcceptedOrderStatus(order?.status || order?.orderStatus)) {
        counts.accepted += 1;
      }

      if (isOutForDeliveryStatus(order?.status || order?.orderStatus)) {
        counts.outForDelivery += 1;
      }

      if (isDeliveredOrderStatus(order?.status || order?.orderStatus)) {
        counts.delivered += 1;
      }

      if (isCancelledOrderStatus(order?.status || order?.orderStatus)) {
        counts.cancelled += 1;
      }

      return counts;
    },
    {
      all: 0,
      accepted: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
    },
  );

export const extractOrderFromEventPayload = payload =>
  payload?.order || payload?.data || payload || null;

export const shouldRefreshOrdersOnFocus = ({
  hasLoaded,
  isConnected,
  lastRefreshAt,
  now = Date.now(),
  staleAfterMs = ORDER_REFRESH_STALE_MS,
}) => {
  if (!hasLoaded) {
    return true;
  }

  if (!isConnected) {
    return true;
  }

  if (!lastRefreshAt) {
    return true;
  }

  return now - lastRefreshAt >= staleAfterMs;
};

export const createInitialOwnerOrdersState = () => ({
  orders: [],
  isLoading: false,
  isRefreshing: false,
  hasLoaded: false,
  error: '',
  lastRefreshAt: 0,
  lastSocketEventAt: 0,
  pendingActions: {},
});

export const ownerOrdersReducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_START':
      return {
        ...state,
        error: '',
        isLoading: !state.hasLoaded && !action.silent,
        isRefreshing: state.hasLoaded || action.silent,
      };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        orders: dedupeOrders(action.orders || []),
        isLoading: false,
        isRefreshing: false,
        hasLoaded: true,
        error: '',
        lastRefreshAt: action.receivedAt || Date.now(),
      };
    case 'LOAD_FAILURE':
      return {
        ...state,
        isLoading: false,
        isRefreshing: false,
        error: action.error || 'Unable to load orders.',
      };
    case 'UPSERT_ORDER':
      return {
        ...state,
        orders: mergeOrderIntoOrders(state.orders, action.order),
        lastSocketEventAt: action.receivedAt || Date.now(),
      };
    case 'CLEAR_ORDERS':
      return {
        ...createInitialOwnerOrdersState(),
        hasLoaded: action.keepLoaded ? state.hasLoaded : false,
      };
    case 'STATUS_ACTION_START':
      return {
        ...state,
        pendingActions: {
          ...state.pendingActions,
          [action.orderId]: action.status,
        },
      };
    case 'STATUS_ACTION_FINISH': {
      const nextPendingActions = { ...state.pendingActions };
      delete nextPendingActions[action.orderId];

      return {
        ...state,
        pendingActions: nextPendingActions,
      };
    }
    default:
      return state;
  }
};

export const selectOrderStats = (orders = []) =>
  orders.reduce(
    (stats, order) => {
      const status = order?.status || order?.orderStatus;

      stats.totalOrders += 1;

      if (isPendingOrderStatus(status)) {
        stats.pendingOrders += 1;
      }

      if (isAcceptedOrderStatus(status)) {
        stats.acceptedOrders += 1;
      }

      if (isDeliveredOrderStatus(status)) {
        stats.deliveredOrders += 1;
        stats.totalRevenue += Number(order?.total || 0);
      }

      if (isCancelledOrderStatus(status)) {
        stats.cancelledOrders += 1;
      }

      if (isOutForDeliveryStatus(status)) {
        stats.outForDeliveryOrders += 1;
      }

      return stats;
    },
    {
      totalOrders: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      outForDeliveryOrders: 0,
      totalRevenue: 0,
    },
  );

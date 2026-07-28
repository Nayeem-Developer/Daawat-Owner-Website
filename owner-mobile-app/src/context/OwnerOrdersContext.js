import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import { fetchOrders, updateOrderStatus as updateOrderStatusRequest } from '../api/ownerApi';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import {
  canTransitionOrder,
  getOrderStatusConflictMessage,
} from '../utils/orderStatus';
import {
  createInitialOwnerOrdersState,
  DEFAULT_OWNER_ORDER_LIMIT,
  extractOrderFromEventPayload,
  ORDER_REFRESH_STALE_MS,
  ownerOrdersReducer,
  selectOrderStats,
  shouldRefreshOrdersOnFocus,
} from '../utils/orderStore';
import { getOrderIdentifier } from '../utils/formatters';
import { normalizeOwnerOrderEvent } from '../utils/ownerOrderEvents';

const OwnerOrdersContext = createContext(null);
const ORDER_REFRESH_COOLDOWN_MS = 1500;
const logOwnerRefresh = message => {
  console.log(`[OWNER_REFRESH] ${message}`);
};

export const OwnerOrdersProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { connectionSerial, isConnected, lastOrderEvent } = useSocket();
  const [state, dispatch] = useReducer(
    ownerOrdersReducer,
    undefined,
    createInitialOwnerOrdersState,
  );
  const appStateRef = useRef(AppState?.currentState ?? 'active');
  const refreshInFlightRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const isConnectedRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const lastReconnectSerialRef = useRef(0);
  const ordersRef = useRef([]);

  useEffect(() => {
    ordersRef.current = state.orders;
  }, [state.orders]);

  useEffect(() => {
    hasLoadedRef.current = state.hasLoaded;
    lastRefreshAtRef.current = state.lastRefreshAt;
  }, [state.hasLoaded, state.lastRefreshAt]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const refreshOrders = useCallback(
    async ({
      silent = false,
      reason = 'manual',
      force = false,
      ignoreCooldown = false,
    } = {}) => {
      if (!isAuthenticated) {
        dispatch({ type: 'CLEAR_ORDERS' });
        return [];
      }

      if (refreshInFlightRef.current) {
        logOwnerRefresh(`skip reason=${reason} cause=in_flight`);
        return refreshInFlightRef.current;
      }

      const now = Date.now();
      const hasLoaded = hasLoadedRef.current;
      const lastRefreshAt = lastRefreshAtRef.current;

      if (
        !ignoreCooldown &&
        hasLoaded &&
        lastRefreshAt &&
        now - lastRefreshAt < ORDER_REFRESH_COOLDOWN_MS
      ) {
        logOwnerRefresh(`skip reason=${reason} cause=cooldown`);
        return ordersRef.current;
      }

      dispatch({ type: 'LOAD_START', silent, reason });
      logOwnerRefresh(`start reason=${reason} force=${force ? '1' : '0'}`);

      const request = (async () => {
        try {
          const response = await fetchOrders({ limit: DEFAULT_OWNER_ORDER_LIMIT });
          const nextOrders = response?.orders || [];
          dispatch({
            type: 'LOAD_SUCCESS',
            orders: nextOrders,
            receivedAt: Date.now(),
            reason,
          });
          logOwnerRefresh(
            `success reason=${reason} count=${Array.isArray(nextOrders) ? nextOrders.length : 0}`,
          );
          return nextOrders;
        } catch (error) {
          dispatch({
            type: 'LOAD_FAILURE',
            error: error?.message || 'Failed to load orders.',
            reason,
          });
          logOwnerRefresh(`failure reason=${reason} message=${error?.message || 'unknown'}`);
          throw error;
        } finally {
          refreshInFlightRef.current = null;
        }
      })();

      refreshInFlightRef.current = request;
      return request;
    },
    [isAuthenticated],
  );

  const refreshOrdersIfStale = useCallback(
    async ({ reason = 'focus', staleAfterMs = ORDER_REFRESH_STALE_MS } = {}) => {
      const shouldRefresh = shouldRefreshOrdersOnFocus({
        hasLoaded: hasLoadedRef.current,
        isConnected: isConnectedRef.current,
        lastRefreshAt: lastRefreshAtRef.current,
        staleAfterMs,
      });

      if (!shouldRefresh) {
        logOwnerRefresh(`skip reason=${reason} cause=fresh`);
        return ordersRef.current;
      }

      return refreshOrders({ silent: true, reason });
    },
    [refreshOrders],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch({ type: 'CLEAR_ORDERS' });
      refreshInFlightRef.current = null;
      hasLoadedRef.current = false;
      lastRefreshAtRef.current = 0;
      lastReconnectSerialRef.current = 0;
      ordersRef.current = [];
      return;
    }

    if (!hasLoadedRef.current) {
      void refreshOrders({ reason: 'initial_load' });
    }
  }, [isAuthenticated, refreshOrders]);

  useEffect(() => {
    if (!isAuthenticated || !connectionSerial) {
      return;
    }

    if (connectionSerial === lastReconnectSerialRef.current) {
      return;
    }

    lastReconnectSerialRef.current = connectionSerial;

    void refreshOrders({
      silent: hasLoadedRef.current,
      force: true,
      reason: 'socket_reconnect',
    });
  }, [connectionSerial, isAuthenticated, refreshOrders]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    if (!AppState?.addEventListener) {
      return undefined;
    }

    const handleAppStateChange = nextAppState => {
      const wasBackgrounded =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';

      if (nextAppState === appStateRef.current) {
        return;
      }

      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && wasBackgrounded) {
        void refreshOrders({
          silent: true,
          force: true,
          reason: 'app_resume',
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove?.();
    };
  }, [isAuthenticated, refreshOrders]);

  const getOrderById = useCallback(orderId => {
    if (!orderId) {
      return null;
    }

    return (
      ordersRef.current.find(order => getOrderIdentifier(order) === orderId) || null
    );
  }, []);

  const applyIncomingOrderUpdate = useCallback((payloadOrOrder, options = {}) => {
    const normalizedOrderEvent = normalizeOwnerOrderEvent(payloadOrOrder);
    const incomingOrder =
      normalizedOrderEvent?.order || extractOrderFromEventPayload(payloadOrOrder);

    if (!incomingOrder) {
      return null;
    }

    dispatch({
      type: 'UPSERT_ORDER',
      order: incomingOrder,
      receivedAt: options.receivedAt || Date.now(),
      reason: options.reason || 'external_event',
    });

    return incomingOrder;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !lastOrderEvent?.receivedAt) {
      return;
    }

    if (lastOrderEvent.eventName === 'orders_cleared') {
      dispatch({ type: 'CLEAR_ORDERS', keepLoaded: true });
      return;
    }

    applyIncomingOrderUpdate(lastOrderEvent.payload, {
      receivedAt: lastOrderEvent.receivedAt,
      reason: lastOrderEvent.eventName,
    });
  }, [applyIncomingOrderUpdate, isAuthenticated, lastOrderEvent]);

  const updateOrderStatus = useCallback(async (orderId, nextStatus) => {
    const latestOrder = getOrderById(orderId);

    if (!latestOrder) {
      const missingOrderError = new Error('This order is no longer available.');
      missingOrderError.code = 'ORDER_NOT_FOUND';
      throw missingOrderError;
    }

    if (!canTransitionOrder(latestOrder, nextStatus)) {
      const statusConflictError = new Error(
        getOrderStatusConflictMessage(latestOrder),
      );
      statusConflictError.code = 'ORDER_STATUS_CONFLICT';
      statusConflictError.status = 409;
      statusConflictError.order = latestOrder;
      throw statusConflictError;
    }

    dispatch({
      type: 'STATUS_ACTION_START',
      orderId,
      status: nextStatus,
    });

    try {
      const updatedOrder = await updateOrderStatusRequest(orderId, nextStatus);
      dispatch({
        type: 'UPSERT_ORDER',
        order: updatedOrder,
        receivedAt: Date.now(),
        reason: 'status_action',
      });
      return updatedOrder;
    } catch (error) {
      if (error?.status === 409 && error?.order) {
        dispatch({
          type: 'UPSERT_ORDER',
          order: error.order,
          receivedAt: Date.now(),
          reason: 'status_conflict',
        });
      }
      throw error;
    } finally {
      dispatch({
        type: 'STATUS_ACTION_FINISH',
        orderId,
      });
    }
  }, [getOrderById]);

  const orderStats = useMemo(() => selectOrderStats(state.orders), [state.orders]);

  const value = useMemo(
    () => ({
      orders: state.orders,
      isConnected,
      isLoading: state.isLoading,
      isRefreshing: state.isRefreshing,
      hasLoaded: state.hasLoaded,
      error: state.error,
      pendingActions: state.pendingActions,
      orderStats,
      refreshOrders,
      refreshOrdersIfStale,
      getOrderById,
      applyIncomingOrderUpdate,
      updateOrderStatus,
    }),
    [
      applyIncomingOrderUpdate,
      getOrderById,
      isConnected,
      orderStats,
      refreshOrders,
      refreshOrdersIfStale,
      state.error,
      state.hasLoaded,
      state.isLoading,
      state.isRefreshing,
      state.orders,
      state.pendingActions,
      updateOrderStatus,
    ],
  );

  return (
    <OwnerOrdersContext.Provider value={value}>
      {children}
    </OwnerOrdersContext.Provider>
  );
};

export const useOwnerOrders = () => {
  const context = useContext(OwnerOrdersContext);

  if (!context) {
    throw new Error('useOwnerOrders must be used inside OwnerOrdersProvider');
  }

  return context;
};

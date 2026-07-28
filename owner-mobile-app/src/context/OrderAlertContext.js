import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import NewOrderAlertModal from "../components/NewOrderAlertModal";
import OrderCancellationAlertModal from "../components/OrderCancellationAlertModal";
import { navigateToOrderDetails } from "../navigation/navigationService";
import { useAuth } from "./AuthContext";
import { useOwnerOrders } from "./OwnerOrdersContext";
import { useSocket } from "./SocketContext";
import {
  startOrderAlertSound,
  stopOrderAlertSound,
} from "../services/orderAlertSound";
import { getPendingOrdersOldestFirst } from "../utils/orderAlert";
import {
  displayNewOrderNotification,
  stopOrderAlert,
} from "../services/notificationService";
import {
  hasProcessedOwnerEvent,
  hydrateProcessedOwnerEvents,
  isOwnerCancellationEvent,
  markOwnerEventProcessed,
  normalizeOwnerOrderEvent,
} from "../utils/ownerOrderEvents";

const OrderAlertContext = createContext(null);

const getOrderKey = (order) => order?._id || order?.orderId || "";

export const OrderAlertProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { lastOrderEvent } = useSocket();
  const {
    applyIncomingOrderUpdate,
    orders,
    refreshOrders,
    updateOrderStatus,
    pendingActions,
  } = useOwnerOrders();
  const [activeOrder, setActiveOrder] = useState(null);
  const [cancellationAlertOrder, setCancellationAlertOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);
  const ordersRef = useRef(orders || []);

  useEffect(() => {
    ordersRef.current = orders || [];
  }, [orders]);

  useEffect(() => {
    void hydrateProcessedOwnerEvents();
  }, []);

  const refreshOrderAlerts = useCallback(
    async ({ broadcast = false, sync = false } = {}) => {
      if (!isAuthenticated) {
        setActiveOrder(null);
        return [];
      }

      try {
        let sourceOrders = ordersRef.current;

        if (sync) {
          sourceOrders =
            (await refreshOrders({
              silent: true,
              reason: 'order_alert_refresh',
            })) || sourceOrders;
        }

        const pendingOrders = getPendingOrdersOldestFirst(sourceOrders);

        setActiveOrder((current) => {
          const currentKey = getOrderKey(current);
          const updatedCurrent = pendingOrders.find((order) => getOrderKey(order) === currentKey);
          return updatedCurrent || pendingOrders[0] || null;
        });

        if (broadcast) {
          setRefreshSignal(Date.now());
        }

        return pendingOrders;
      } catch (error) {
        if (__DEV__) {
          console.log("[order-alert] refresh failed", error?.message || error);
        }

        return [];
      }
    },
    [isAuthenticated, refreshOrders]
  );

  const presentCancellationAlert = useCallback(
    async (payload) => {
      if (!isAuthenticated) {
        return false;
      }

      const event = normalizeOwnerOrderEvent(payload);

      if (!event?.order || !isOwnerCancellationEvent(event)) {
        return false;
      }

      if (await hasProcessedOwnerEvent(event)) {
        return false;
      }

      applyIncomingOrderUpdate(event.order, {
        reason: 'foreground_cancellation_alert',
      });
      await markOwnerEventProcessed(event);
      setCancellationAlertOrder(event.order);
      return true;
    },
    [applyIncomingOrderUpdate, isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveOrder(null);
      setCancellationAlertOrder(null);
      setErrorMessage("");
      stopOrderAlertSound();
      return undefined;
    }

    const pendingOrders = getPendingOrdersOldestFirst(orders || []);
    setActiveOrder((current) => {
      const currentKey = getOrderKey(current);
      const updatedCurrent = pendingOrders.find((order) => getOrderKey(order) === currentKey);
      return updatedCurrent || pendingOrders[0] || null;
    });
  }, [isAuthenticated, orders]);

  useEffect(() => {
    if (!isAuthenticated || (!activeOrder && !cancellationAlertOrder)) {
      stopOrderAlertSound();
      return undefined;
    }

    void startOrderAlertSound();

    return () => {
      if (!activeOrder && !cancellationAlertOrder) {
        stopOrderAlertSound();
      }
    };
  }, [activeOrder?._id, cancellationAlertOrder?._id, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !activeOrder) {
      void stopOrderAlert();
      return undefined;
    }

    setErrorMessage("");
    void displayNewOrderNotification(activeOrder);
  }, [activeOrder?._id, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !lastOrderEvent?.receivedAt) {
      return;
    }

    if (!isOwnerCancellationEvent(lastOrderEvent.payload)) {
      return;
    }

    void presentCancellationAlert(lastOrderEvent.payload);
  }, [isAuthenticated, lastOrderEvent, presentCancellationAlert]);

  const handleResolveOrder = useCallback(
    async (nextStatus) => {
      const currentOrderId = activeOrder?._id;

      if (!currentOrderId) {
        return;
      }

      try {
        setErrorMessage("");

        await updateOrderStatus(currentOrderId, nextStatus);
        await stopOrderAlert(currentOrderId);
        setActiveOrder((current) => (getOrderKey(current) === currentOrderId ? null : current));
        await refreshOrderAlerts({ broadcast: true });
      } catch (error) {
        setErrorMessage(error?.message || `Unable to update order to ${nextStatus}.`);
      }
    },
    [activeOrder, refreshOrderAlerts, updateOrderStatus]
  );

  const handleDismissCancellationAlert = useCallback(() => {
    stopOrderAlertSound();
    setCancellationAlertOrder(null);
  }, []);

  const handleViewCancelledOrder = useCallback(() => {
    const currentOrder = cancellationAlertOrder;
    stopOrderAlertSound();
    setCancellationAlertOrder(null);

    if (!currentOrder) {
      return;
    }

    navigateToOrderDetails(currentOrder);
  }, [cancellationAlertOrder]);

  const value = useMemo(
    () => ({
      activeOrder,
      cancellationAlertOrder,
      handleForegroundOrderEvent: presentCancellationAlert,
      refreshSignal,
      requestOrderAlertRefresh: refreshOrderAlerts,
    }),
    [
      activeOrder,
      cancellationAlertOrder,
      presentCancellationAlert,
      refreshOrderAlerts,
      refreshSignal,
    ]
  );

  return (
    <OrderAlertContext.Provider value={value}>
      {children}
      <NewOrderAlertModal
        visible={Boolean(activeOrder)}
        order={activeOrder}
        errorMessage={errorMessage}
        pendingStatus={pendingActions[activeOrder?._id] || ''}
        onAccept={() => void handleResolveOrder("Accepted")}
        onReject={() => void handleResolveOrder("Rejected")}
      />
      <OrderCancellationAlertModal
        visible={Boolean(cancellationAlertOrder)}
        order={cancellationAlertOrder}
        onAcknowledge={handleDismissCancellationAlert}
        onViewOrder={handleViewCancelledOrder}
      />
      {/* TODO: For background or closed-app alerts, integrate FCM/Notifee later. */}
    </OrderAlertContext.Provider>
  );
};

export const useOrderAlert = () => {
  const context = useContext(OrderAlertContext);

  if (!context) {
    throw new Error("useOrderAlert must be used inside OrderAlertProvider");
  }

  return context;
};

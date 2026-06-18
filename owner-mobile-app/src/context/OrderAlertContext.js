import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import NewOrderAlertModal from "../components/NewOrderAlertModal";
import { fetchOrders, updateOrderStatus } from "../api/ownerApi";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import {
  startOrderAlertSound,
  stopOrderAlertSound,
} from "../services/orderAlertSound";
import { getPendingOrdersOldestFirst } from "../utils/orderAlert";

const POLL_INTERVAL_MS = 15000;
const OrderAlertContext = createContext(null);

const getOrderKey = (order) => order?._id || order?.orderId || "";

export const OrderAlertProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { lastOrderEvent } = useSocket();
  const [activeOrder, setActiveOrder] = useState(null);
  const [pendingStatus, setPendingStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const refreshOrderAlerts = useCallback(
    async ({ broadcast = false } = {}) => {
      if (!isAuthenticated) {
        setActiveOrder(null);
        return [];
      }

      try {
        const response = await fetchOrders({ limit: 100 });
        const pendingOrders = getPendingOrdersOldestFirst(response?.orders || []);

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
    [isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveOrder(null);
      setPendingStatus("");
      setErrorMessage("");
      stopOrderAlertSound();
      return undefined;
    }

    void refreshOrderAlerts();

    const interval = setInterval(() => {
      void refreshOrderAlerts();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshOrderAlerts]);

  useEffect(() => {
    if (!isAuthenticated || !lastOrderEvent?.receivedAt) {
      return;
    }

    void refreshOrderAlerts();
  }, [isAuthenticated, lastOrderEvent?.receivedAt, refreshOrderAlerts]);

  useEffect(() => {
    if (!isAuthenticated || !activeOrder) {
      stopOrderAlertSound();
      return undefined;
    }

    setErrorMessage("");
    void startOrderAlertSound();

    return () => {
      stopOrderAlertSound();
    };
  }, [activeOrder?._id, isAuthenticated]);

  const handleResolveOrder = useCallback(
    async (nextStatus) => {
      const currentOrderId = activeOrder?._id;

      if (!currentOrderId) {
        return;
      }

      try {
        setPendingStatus(nextStatus);
        setErrorMessage("");

        await updateOrderStatus(currentOrderId, nextStatus);
        setActiveOrder((current) => (getOrderKey(current) === currentOrderId ? null : current));
        await refreshOrderAlerts({ broadcast: true });
      } catch (error) {
        setErrorMessage(error?.message || `Unable to update order to ${nextStatus}.`);
      } finally {
        setPendingStatus("");
      }
    },
    [activeOrder, refreshOrderAlerts]
  );

  const value = useMemo(
    () => ({
      activeOrder,
      refreshSignal,
      requestOrderAlertRefresh: refreshOrderAlerts,
    }),
    [activeOrder, refreshOrderAlerts, refreshSignal]
  );

  return (
    <OrderAlertContext.Provider value={value}>
      {children}
      <NewOrderAlertModal
        visible={Boolean(activeOrder)}
        order={activeOrder}
        errorMessage={errorMessage}
        pendingStatus={pendingStatus}
        onAccept={() => void handleResolveOrder("Accepted")}
        onReject={() => void handleResolveOrder("Rejected")}
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

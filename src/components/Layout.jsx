import { Outlet, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Modal from "./Modal";
import Toast from "./Toast";
import api, { clearOwnerSession, getErrorMessage } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import {
  formatCurrency,
  formatDateTime,
  getOrderIdentifier,
  getOrderItemName,
  isExpiredOrder,
  matchesOrderFilter,
  normalizeOrder,
} from "../services/formatters";

const ORDER_ALERT_SOUND_PATH = "/sounds/order-alert.mp3";
const ORDER_ALERT_REPEAT_COUNT = 3;
const ORDER_ALERT_GAP_MS = 700;
const ORDER_HIGHLIGHT_MS = 5000;
const SOUND_UNLOCKED_STORAGE_KEY = "daawat_owner_sound_unlocked";
const DEFAULT_ORDER_LIMIT = 100;

const INITIAL_STATS = {
  totalOrders: 0,
  pendingOrders: 0,
  acceptedOrders: 0,
  outForDeliveryOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  totalRevenue: 0,
};

const INITIAL_PAGINATION = {
  page: 1,
  limit: DEFAULT_ORDER_LIMIT,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

const getAppStatusFromResponse = (response) => {
  const source = response?.data?.data || response?.data || {};
  return {
    isActive: source?.isActive !== false,
    message: source?.message || "",
  };
};

const delay = (durationMs) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

const dedupeOrders = (list) => {
  const seen = new Set();
  const deduped = [];

  for (const order of list) {
    const id = getOrderIdentifier(order);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    deduped.push(order);
  }

  return deduped;
};

const mergeIncomingOrder = (currentOrders, incomingOrder, limit) => {
  const nextId = getOrderIdentifier(incomingOrder);
  const maxItems = limit || DEFAULT_ORDER_LIMIT;

  if (!nextId) {
    return [incomingOrder, ...currentOrders].slice(0, maxItems);
  }

  const existingIndex = currentOrders.findIndex(
    (order) => getOrderIdentifier(order) === nextId
  );

  if (existingIndex === -1) {
    return [incomingOrder, ...currentOrders].slice(0, maxItems);
  }

  const updatedOrders = [...currentOrders];
  updatedOrders[existingIndex] = incomingOrder;
  return dedupeOrders(updatedOrders).slice(0, maxItems);
};

const isExpiredStatus = (status) => isExpiredOrder(status);

const isOrderExpiredError = (error) =>
  getErrorMessage(error, "")
    .toLowerCase()
    .includes("confirmation time expired");

const normalizePagination = (rawPagination, page, limit, totalFromPayload, listLength) => {
  if (rawPagination && typeof rawPagination === "object") {
    return {
      page: Number(rawPagination.page || page),
      limit: Number(rawPagination.limit || limit),
      total: Number(rawPagination.total || 0),
      totalPages: Number(rawPagination.totalPages || 0),
      hasNextPage: Boolean(rawPagination.hasNextPage),
      hasPrevPage: Boolean(rawPagination.hasPrevPage),
    };
  }

  const total = Number.isFinite(totalFromPayload) ? Number(totalFromPayload) : listLength;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: totalPages > page,
    hasPrevPage: page > 1,
  };
};

const getListFromResponseBody = (responseBody, keys = []) => {
  const items = Array.isArray(responseBody?.data)
    ? responseBody.data
    : Array.isArray(responseBody?.items)
      ? responseBody.items
      : Array.isArray(responseBody)
        ? responseBody
        : [];

  if (items.length > 0) {
    return items;
  }

  for (const key of keys) {
    if (Array.isArray(responseBody?.[key])) {
      return responseBody[key];
    }

    if (Array.isArray(responseBody?.data?.[key])) {
      return responseBody.data[key];
    }
  }

  return items;
};

export default function Layout() {
  const navigate = useNavigate();
  const notificationAudioRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersPagination, setOrdersPagination] = useState(INITIAL_PAGINATION);
  const [ordersFilters, setOrdersFilters] = useState({
    search: "",
    status: "",
    limit: DEFAULT_ORDER_LIMIT,
  });

  const [orderStats, setOrderStats] = useState(INITIAL_STATS);
  const [orderStatsLoading, setOrderStatsLoading] = useState(true);

  const [highlightedOrderId, setHighlightedOrderId] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(
    () => localStorage.getItem(SOUND_UNLOCKED_STORAGE_KEY) === "true"
  );
  const [showAudioUnlockHint, setShowAudioUnlockHint] = useState(false);

  const [activeIncomingOrder, setActiveIncomingOrder] = useState(null);
  const [customerCancelledOrder, setCustomerCancelledOrder] = useState(null);
  const [incomingOrderActionLoading, setIncomingOrderActionLoading] = useState(false);
  const [appStatusLoading, setAppStatusLoading] = useState(true);
  const [appStatusUpdating, setAppStatusUpdating] = useState(false);
  const [appStatusConfirmOpen, setAppStatusConfirmOpen] = useState(false);
  const [appStatus, setAppStatus] = useState({
    isActive: true,
    message: "Daawat is accepting orders",
  });

  const isSearchActive = Boolean(ordersFilters.search.trim());

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type: "info", ...toast }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearOrdersAndRevenueState = useCallback(
    ({ showToast = false, toastMessage = "Orders data was cleared" } = {}) => {
      setOrders([]);
      setOrderStats({ ...INITIAL_STATS });
      setOrdersPagination((prev) => ({
        ...prev,
        page: 1,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      }));
      setActiveIncomingOrder(null);
      setCustomerCancelledOrder(null);

      if (showToast) {
        addToast({
          title: "Orders cleared",
          message: toastMessage,
          type: "success",
        });
      }
    },
    [addToast]
  );

  const updateAppStatus = useCallback(
    async (isActive) => {
      const previousStatus = appStatus;
      const message = isActive
        ? "Daawat is accepting orders"
        : "Daawat is currently not accepting orders";

      try {
        setAppStatusUpdating(true);
        setAppStatus({ isActive, message });
        const response = await api.patch("/api/owner/app-status", {
          isActive,
          message,
        });
        setAppStatus(getAppStatusFromResponse(response));
        addToast({
          title: "Success",
          message: isActive ? "App marked active" : "App marked inactive",
          type: "success",
        });
      } catch (error) {
        setAppStatus(previousStatus);
        addToast({
          title: "Update failed",
          message: getErrorMessage(error, "Failed to update app status"),
          type: "error",
        });
      } finally {
        setAppStatusUpdating(false);
      }
    },
    [addToast, appStatus]
  );

  const handleAppStatusToggle = useCallback(() => {
    if (appStatusLoading || appStatusUpdating) {
      return;
    }

    if (appStatus.isActive) {
      setAppStatusConfirmOpen(true);
      return;
    }

    void updateAppStatus(true);
  }, [appStatus.isActive, appStatusLoading, appStatusUpdating, updateAppStatus]);

  const confirmMakeInactive = useCallback(() => {
    setAppStatusConfirmOpen(false);
    void updateAppStatus(false);
  }, [updateAppStatus]);

  const unlockNotificationAudio = useCallback(async () => {
    const audio = notificationAudioRef.current;
    if (!audio) {
      return false;
    }

    try {
      audio.volume = 0;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1.0;
      setAudioUnlocked(true);
      setShowAudioUnlockHint(false);
      localStorage.setItem(SOUND_UNLOCKED_STORAGE_KEY, "true");
      return true;
    } catch {
      setAudioUnlocked(false);
      setShowAudioUnlockHint(true);
      return false;
    }
  }, []);

  const playOrderAlert = useCallback(async () => {
    const audio = notificationAudioRef.current;
    if (!audio) {
      return;
    }

    const isReady = audioUnlocked || (await unlockNotificationAudio());
    if (!isReady) {
      setShowAudioUnlockHint(true);
      return;
    }

    for (let repeat = 0; repeat < ORDER_ALERT_REPEAT_COUNT; repeat += 1) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1.0;
        await audio.play();
      } catch {
        setShowAudioUnlockHint(true);
        break;
      }

      if (repeat < ORDER_ALERT_REPEAT_COUNT - 1) {
        await delay(ORDER_ALERT_GAP_MS);
      }
    }
  }, [audioUnlocked, unlockNotificationAudio]);

  useEffect(() => {
    const audio = new Audio(ORDER_ALERT_SOUND_PATH);
    audio.preload = "auto";
    audio.volume = 1.0;
    notificationAudioRef.current = audio;

    return () => {
      audio.pause();
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioUnlocked) {
      return undefined;
    }

    const unlockFromFirstInteraction = () => {
      void unlockNotificationAudio();
    };

    window.addEventListener("pointerdown", unlockFromFirstInteraction, {
      once: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("pointerdown", unlockFromFirstInteraction);
    };
  }, [audioUnlocked, unlockNotificationAudio]);

  useEffect(() => {
    let isMounted = true;

    const loadAppStatus = async () => {
      try {
        setAppStatusLoading(true);
        const response = await api.get("/api/app-status");
        if (!isMounted) {
          return;
        }
        setAppStatus(getAppStatusFromResponse(response));
      } catch (error) {
        if (!isMounted) {
          return;
        }
        addToast({
          title: "App status error",
          message: getErrorMessage(error, "Failed to load app status"),
          type: "error",
        });
      } finally {
        if (isMounted) {
          setAppStatusLoading(false);
        }
      }
    };

    void loadAppStatus();

    return () => {
      isMounted = false;
    };
  }, [addToast]);

  useEffect(() => {
    const socket = connectSocket();

    const handleAppStatusUpdated = (payload) => {
      const nextPayload = payload?.data || payload || {};
      setAppStatus({
        isActive: nextPayload?.isActive !== false,
        message: nextPayload?.message || "",
      });
    };

    socket.on("app_status_updated", handleAppStatusUpdated);

    return () => {
      socket.off("app_status_updated", handleAppStatusUpdated);
    };
  }, []);

  const fetchOrderStats = useCallback(async () => {
    try {
      const response = await api.get("/api/owner/orders/stats");
      const responseBody = response?.data || {};
      const statsCandidate =
        responseBody?.stats ||
        responseBody?.data?.stats ||
        responseBody?.data ||
        {};
      const stats =
        statsCandidate && typeof statsCandidate === "object" && !Array.isArray(statsCandidate)
          ? statsCandidate
          : {};
      setOrderStats({ ...INITIAL_STATS, ...stats });
      return stats;
    } catch {
      return null;
    } finally {
      setOrderStatsLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(
    async ({ append = false, pageOverride = null, filtersOverride = null } = {}) => {
      const activeFilters = filtersOverride
        ? { ...ordersFilters, ...filtersOverride }
        : ordersFilters;
      const page = pageOverride || (append ? ordersPagination.page + 1 : 1);
      const limit = Number(activeFilters.limit) || DEFAULT_ORDER_LIMIT;
      const params = { page, limit };
      const trimmedSearch = activeFilters.search.trim();

      if (trimmedSearch) {
        params.search = trimmedSearch;
      }

      if (activeFilters.status) {
        params.status = activeFilters.status;
      }

      const shouldUseInitialLoader = !append && orders.length === 0 && !ordersRefreshing;
      if (shouldUseInitialLoader) {
        setOrdersLoading(true);
      } else {
        setOrdersRefreshing(true);
      }

      try {
        const response = await api.get("/api/owner/orders", { params });
        const responseBody = response?.data;
        const payload =
          responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)
            ? responseBody
            : {};
        const rawOrders = getListFromResponseBody(responseBody, ["orders"]);
        console.log("Owner panel API response:", responseBody);
        console.log("Parsed items:", rawOrders.length);

        const normalized = rawOrders
          .map((order) => normalizeOrder(order))
          .filter((order) => order && !isExpiredStatus(order.status || order.orderStatus));
        const nextPagination = normalizePagination(
          payload?.pagination,
          page,
          limit,
          payload?.total,
          normalized.length
        );

        setOrders((previous) => {
          if (!append) {
            return normalized;
          }
          return dedupeOrders([...previous, ...normalized]);
        });
        setOrdersPagination(nextPagination);
        setOrdersError("");
      } catch (error) {
        setOrdersError(getErrorMessage(error, "Unable to load orders. Please retry."));
      } finally {
        setOrdersLoading(false);
        setOrdersRefreshing(false);
      }
    },
    [ordersFilters, ordersPagination.page, orders.length, ordersRefreshing]
  );

  const refreshOrders = useCallback(async (options = {}) => {
    await fetchOrders({
      append: false,
      pageOverride: 1,
      filtersOverride: options.filtersOverride || null,
    });
    await fetchOrderStats();
  }, [fetchOrders, fetchOrderStats]);

  const retryOrdersLoad = useCallback(async () => {
    await fetchOrders({ append: false, pageOverride: 1 });
  }, [fetchOrders]);

  const loadMoreOrders = useCallback(async () => {
    if (!ordersPagination.hasNextPage || ordersRefreshing || ordersLoading) {
      return;
    }
    await fetchOrders({ append: true });
  }, [fetchOrders, ordersLoading, ordersPagination.hasNextPage, ordersRefreshing]);

  const applyOrderStatusUpdate = useCallback(
    async (
      order,
      nextStatus,
      { closeIncomingPopup = false, successMessage = null, silent = false } = {}
    ) => {
      const orderId = getOrderIdentifier(order);
      if (!orderId || !nextStatus) {
        return null;
      }

      const response = await api.patch(`/api/owner/orders/${orderId}/status`, {
        orderStatus: nextStatus,
      });
      const updated = normalizeOrder(
        response.data?.data || response.data?.order || response.data
      );

      if (!updated) {
        return null;
      }

      const normalizedUpdated = {
        ...updated,
        cancelledBy:
          nextStatus === "Cancelled" && !updated.cancelledBy
            ? "owner"
            : updated.cancelledBy,
      };

      setOrders((previous) => {
        const existingIndex = previous.findIndex(
          (item) => getOrderIdentifier(item) === orderId
        );
        const statusMatchesFilter = matchesOrderFilter(
          normalizedUpdated,
          ordersFilters.status
        );

        if (!statusMatchesFilter || isExpiredStatus(normalizedUpdated.status)) {
          return previous.filter((item) => getOrderIdentifier(item) !== orderId);
        }

        if (existingIndex === -1) {
          return [normalizedUpdated, ...previous].slice(
            0,
            ordersPagination.limit || DEFAULT_ORDER_LIMIT
          );
        }

        const cloned = [...previous];
        cloned[existingIndex] = normalizedUpdated;
        return cloned;
      });

      if (closeIncomingPopup) {
        setActiveIncomingOrder(null);
      }

      await fetchOrderStats();

      if (!silent) {
        addToast({
          title: "Order updated",
          message:
            successMessage ||
              `Order #${updated.orderId || orderId} moved to ${updated.status}.`,
          type: "success",
        });
      }

      return normalizedUpdated;
    },
    [
      addToast,
      fetchOrderStats,
      ordersFilters.status,
      ordersPagination.limit,
    ]
  );

  const handleIncomingOrderAction = useCallback(
    async (nextStatus) => {
      if (!activeIncomingOrder || incomingOrderActionLoading) {
        return;
      }

      try {
        setIncomingOrderActionLoading(true);
        const actionLabel = nextStatus === "Accepted" ? "accepted" : "cancelled";
        await applyOrderStatusUpdate(activeIncomingOrder, nextStatus, {
          closeIncomingPopup: true,
          successMessage: `Order #${
            activeIncomingOrder.orderId || getOrderIdentifier(activeIncomingOrder)
          } ${actionLabel} successfully.`,
        });
      } catch (error) {
        if (isOrderExpiredError(error)) {
          setActiveIncomingOrder(null);
          await refreshOrders();
        }
        addToast({
          title: "Update failed",
          message: getErrorMessage(error, "Unable to update order status"),
          type: "error",
        });
      } finally {
        setIncomingOrderActionLoading(false);
      }
    },
    [
      activeIncomingOrder,
      addToast,
      applyOrderStatusUpdate,
      incomingOrderActionLoading,
      refreshOrders,
    ]
  );

  useEffect(() => {
    void fetchOrders({ append: false, pageOverride: 1 });
  }, [ordersFilters.search, ordersFilters.status, ordersFilters.limit]);

  useEffect(() => {
    void fetchOrderStats();
  }, [fetchOrderStats]);

  useEffect(() => {
    const socket = connectSocket();

    const handleNewOrder = (payload) => {
      const nextOrder = normalizeOrder(payload?.order || payload?.data || payload);
      if (!nextOrder) {
        return;
      }
      if (isExpiredStatus(nextOrder.status || nextOrder.orderStatus)) {
        return;
      }

      const nextId = getOrderIdentifier(nextOrder);
      const matchesStatusFilter = matchesOrderFilter(nextOrder, ordersFilters.status);

      if (matchesStatusFilter) {
        setOrders((prev) => mergeIncomingOrder(prev, nextOrder, ordersPagination.limit));
      }

      setActiveIncomingOrder(nextOrder);
      setHighlightedOrderId(nextId);
      addToast({
        title: "New order received",
        message: `Order #${nextOrder.orderId || nextId} has arrived.`,
      });
      void playOrderAlert();
      void fetchOrderStats();

      window.setTimeout(() => {
        setHighlightedOrderId((current) => (current === nextId ? "" : current));
      }, ORDER_HIGHLIGHT_MS);
    };

    const handleCustomerCancellation = (payload) => {
      const incoming = normalizeOrder(payload?.order || payload?.data || payload);
      if (!incoming) {
        return;
      }

      const cancellationStatus = incoming.status || incoming.orderStatus;
      const cancellationSource = String(
        incoming.cancelledBy || payload?.cancelledBy || ""
      ).toLowerCase();

      if (cancellationStatus !== "Cancelled" || cancellationSource !== "customer") {
        return;
      }

      const nextId = getOrderIdentifier(incoming);
      const cancelledOrder = {
        ...incoming,
        status: "Cancelled",
        orderStatus: "Cancelled",
        cancelledBy: incoming.cancelledBy || "customer",
      };

      if (nextId) {
        setActiveIncomingOrder((current) =>
          getOrderIdentifier(current) === nextId ? null : current
        );
      }

      setOrders((previous) => {
        const existingIndex = previous.findIndex(
          (order) => getOrderIdentifier(order) === nextId
        );
        const statusMatchesFilter = matchesOrderFilter(
          cancelledOrder,
          ordersFilters.status
        );

        if (existingIndex === -1) {
          if (!statusMatchesFilter) {
            return previous;
          }
          return [cancelledOrder, ...previous].slice(
            0,
            ordersPagination.limit || DEFAULT_ORDER_LIMIT
          );
        }

        if (!statusMatchesFilter) {
          return previous.filter((order) => getOrderIdentifier(order) !== nextId);
        }

        const nextOrders = [...previous];
        nextOrders[existingIndex] = { ...previous[existingIndex], ...cancelledOrder };
        return nextOrders;
      });

      setCustomerCancelledOrder(cancelledOrder);
      setHighlightedOrderId(nextId);
      addToast({
        title: "Order cancelled by customer",
        message: `Order #${cancelledOrder.orderId || nextId} was cancelled by customer.`,
        type: "error",
      });
      void playOrderAlert();
      void fetchOrderStats();

      window.setTimeout(() => {
        setHighlightedOrderId((current) => (current === nextId ? "" : current));
      }, ORDER_HIGHLIGHT_MS);
    };

    const handleOrderConfirmationExpired = (payload) => {
      const incoming = normalizeOrder(payload?.order || payload?.data || payload);
      if (!incoming) {
        return;
      }

      const expiryStatus = incoming.status || incoming.orderStatus;
      if (expiryStatus !== "Expired") {
        return;
      }

      const nextId = getOrderIdentifier(incoming);
      setActiveIncomingOrder((current) =>
        getOrderIdentifier(current) === nextId ? null : current
      );
      setCustomerCancelledOrder((current) =>
        getOrderIdentifier(current) === nextId ? null : current
      );

      setOrders((previous) =>
        previous
          .map((item) =>
            getOrderIdentifier(item) === nextId
              ? { ...item, ...incoming, status: "Expired", orderStatus: "Expired" }
              : item
          )
          .filter((item) => !isExpiredStatus(item?.status || item?.orderStatus))
      );

      addToast({
        title: "Order expired",
        message:
          incoming?.expiryReason || "Order confirmation time expired.",
        type: "error",
      });
      void fetchOrderStats();
    };

    const handleOrdersCleared = () => {
      clearOrdersAndRevenueState({
        showToast: true,
        toastMessage: "Orders data was cleared",
      });
    };

    socket.on("new_order", handleNewOrder);
    socket.on("customer_order_cancelled", handleCustomerCancellation);
    socket.on("order_status_updated", handleCustomerCancellation);
    socket.on("order_confirmation_expired", handleOrderConfirmationExpired);
    socket.on("order_status_updated", handleOrderConfirmationExpired);
    socket.on("orders_cleared", handleOrdersCleared);

    return () => {
      socket.off("new_order", handleNewOrder);
      socket.off("customer_order_cancelled", handleCustomerCancellation);
      socket.off("order_status_updated", handleCustomerCancellation);
      socket.off("order_confirmation_expired", handleOrderConfirmationExpired);
      socket.off("order_status_updated", handleOrderConfirmationExpired);
      socket.off("orders_cleared", handleOrdersCleared);
      disconnectSocket();
    };
  }, [
    addToast,
    clearOrdersAndRevenueState,
    refreshOrders,
    fetchOrderStats,
    ordersFilters.status,
    ordersPagination.limit,
    playOrderAlert,
  ]);

  const handleLogout = useCallback(() => {
    clearOwnerSession();
    disconnectSocket();
    navigate("/login", { replace: true });
  }, [navigate]);

  const updateOrdersFilters = useCallback((updater) => {
    setOrdersFilters((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return { ...prev, ...next };
    });
  }, []);

  const outletContext = useMemo(
    () => ({
      orders,
      setOrders,
      ordersLoading,
      ordersRefreshing,
      ordersError,
      ordersPagination,
      ordersFilters,
      setOrdersFilters: updateOrdersFilters,
      refreshOrders,
      retryOrdersLoad,
      loadMoreOrders,
      hasMoreOrders: ordersPagination.hasNextPage,
      addToast,
      highlightedOrderId,
      orderStats,
      orderStatsLoading,
      refreshOrderStats: fetchOrderStats,
      clearOrdersAndRevenueState,
      isSearchActive,
      updateOrderStatus: applyOrderStatusUpdate,
    }),
    [
      orders,
      ordersLoading,
      ordersRefreshing,
      ordersError,
      ordersPagination,
      ordersFilters,
      updateOrdersFilters,
      refreshOrders,
      retryOrdersLoad,
      loadMoreOrders,
      addToast,
      highlightedOrderId,
      orderStats,
      orderStatsLoading,
      fetchOrderStats,
      clearOrdersAndRevenueState,
      isSearchActive,
      applyOrderStatusUpdate,
    ]
  );

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-shell">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onLogout={handleLogout}
          appStatusControl={{
            isActive: appStatus.isActive,
            isLoading: appStatusLoading,
            isUpdating: appStatusUpdating,
            onToggle: handleAppStatusToggle,
          }}
        />

        <section className="content-shell" onClick={() => setSidebarOpen(false)}>
          {showAudioUnlockHint && (
            <div className="audio-unlock-hint" role="status">
              Click anywhere once to enable order notification sound.
            </div>
          )}
          <Outlet context={outletContext} />
        </section>
      </main>

      {activeIncomingOrder && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-large">
            <div className="modal-order-head">
              <h3>New Order Received</h3>
              <button
                className="btn ghost"
                onClick={() => setActiveIncomingOrder(null)}
                disabled={incomingOrderActionLoading}
              >
                Close
              </button>
            </div>

            <div className="modal-order-grid">
              <p>
                <span>Order ID:</span> #{activeIncomingOrder.orderId || getOrderIdentifier(activeIncomingOrder)}
              </p>
              <p>
                <span>Customer:</span> {activeIncomingOrder.customerName || "N/A"}
              </p>
              <p>
                <span>Mobile:</span> {activeIncomingOrder.phone || "N/A"}
              </p>
              <p>
                <span>Address:</span> {activeIncomingOrder.addressText || activeIncomingOrder.address || "N/A"}
              </p>
              <p>
                <span>Total:</span> {formatCurrency(activeIncomingOrder.total)}
              </p>
              <p>
                <span>Payment Method:</span> {activeIncomingOrder.paymentMethod || "N/A"}
              </p>
              <p>
                <span>Payment Status:</span> {activeIncomingOrder.paymentStatus || "N/A"}
              </p>
              <p>
                <span>Created:</span> {formatDateTime(activeIncomingOrder.createdAt)}
              </p>
              {activeIncomingOrder.latitude && activeIncomingOrder.longitude && (
                <p>
                  <a
                    className="map-btn"
                    href={`https://www.google.com/maps?q=${activeIncomingOrder.latitude},${activeIncomingOrder.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Location
                  </a>
                </p>
              )}
            </div>

            <div className="modal-order-items">
              <h4>Ordered Items</h4>
              {activeIncomingOrder.items?.length ? (
                <ul>
                  {activeIncomingOrder.items.map((item, idx) => (
                    <li key={`${item?.itemId || item?._id || idx}`}>
                      <div className="order-item-main">
                        <strong>{getOrderItemName(item)}</strong>
                        <span>
                          Qty: {item?.quantity || item?.qty || 1} x{" "}
                          {formatCurrency(
                            item?.price || item?.unitPrice || item?.menuItem?.price || 0
                          )}
                        </span>
                        {(item?.itemId || item?._id) && (
                          <small>Item ID: {String(item?.itemId || item?._id)}</small>
                        )}
                      </div>
                      <span className="order-item-line-total">
                        {formatCurrency(
                          (item?.quantity || item?.qty || 1) *
                            (item?.price || item?.unitPrice || item?.menuItem?.price || 0)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No items found</p>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn danger"
                onClick={() => void handleIncomingOrderAction("Cancelled")}
                disabled={incomingOrderActionLoading}
              >
                {incomingOrderActionLoading ? "Please wait..." : "Reject"}
              </button>
              <button
                className="btn"
                onClick={() => void handleIncomingOrderAction("Accepted")}
                disabled={incomingOrderActionLoading}
              >
                {incomingOrderActionLoading ? "Please wait..." : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {customerCancelledOrder && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-large cancelled-modal">
            <div className="modal-order-head">
              <h3>Order Cancelled by Customer</h3>
              <button
                className="btn ghost"
                onClick={() => setCustomerCancelledOrder(null)}
              >
                Close
              </button>
            </div>

            <div className="modal-order-grid">
              <p>
                <span>Order ID:</span> #
                {customerCancelledOrder.orderId ||
                  getOrderIdentifier(customerCancelledOrder)}
              </p>
              <p>
                <span>Customer:</span> {customerCancelledOrder.customerName || "N/A"}
              </p>
              <p>
                <span>Phone:</span> {customerCancelledOrder.phone || "N/A"}
              </p>
              <p>
                <span>Address:</span>{" "}
                {customerCancelledOrder.addressText ||
                  customerCancelledOrder.address ||
                  "N/A"}
              </p>
              <p>
                <span>Total:</span> {formatCurrency(customerCancelledOrder.total)}
              </p>
              <p>
                <span>Previous Status:</span>{" "}
                {customerCancelledOrder.previousStatus || "N/A"}
              </p>
              <p>
                <span>Cancelled At:</span>{" "}
                {formatDateTime(
                  customerCancelledOrder.cancelledAt || customerCancelledOrder.updatedAt
                )}
              </p>
            </div>

            <div className="modal-order-items">
              <h4>Ordered Items</h4>
              {customerCancelledOrder.items?.length ? (
                <ul>
                  {customerCancelledOrder.items.map((item, idx) => (
                    <li key={`${item?.itemId || item?._id || idx}`}>
                      <div className="order-item-main">
                        <strong>{getOrderItemName(item)}</strong>
                        <span>
                          Qty: {item?.quantity || item?.qty || 1} x{" "}
                          {formatCurrency(
                            item?.price || item?.unitPrice || item?.menuItem?.price || 0
                          )}
                        </span>
                        {(item?.itemId || item?._id) && (
                          <small>Item ID: {String(item?.itemId || item?._id)}</small>
                        )}
                      </div>
                      <span className="order-item-line-total">
                        {formatCurrency(
                          (item?.quantity || item?.qty || 1) *
                            (item?.price || item?.unitPrice || item?.menuItem?.price || 0)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No items found</p>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn danger" onClick={() => setCustomerCancelledOrder(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onClose={removeToast} />

      <Modal
        isOpen={appStatusConfirmOpen}
        title="Make app inactive?"
        description="Customers will not be able to place orders until you activate the app again."
        cancelText="Cancel"
        confirmText="Yes, make inactive"
        loading={appStatusUpdating}
        onCancel={() => setAppStatusConfirmOpen(false)}
        onConfirm={confirmMakeInactive}
      />
    </div>
  );
}

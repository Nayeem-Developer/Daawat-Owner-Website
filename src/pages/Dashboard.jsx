import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import api, { getErrorMessage } from "../services/api";
import {
  formatCurrency,
  formatDateTime,
  getOrderIdentifier,
  getOrderItemName,
} from "../services/formatters";
import { connectSocket } from "../services/socket";

const DASHBOARD_SEARCH_DEBOUNCE_MS = 300;
const DASHBOARD_LIMIT = 100;

const DASHBOARD_TABS = [
  { key: "total", title: "Total Orders", heading: "All Orders", status: "" },
  { key: "accepted", title: "Accepted Orders", heading: "Accepted Orders", status: "Accepted" },
  {
    key: "out_for_delivery",
    title: "Out for Delivery",
    heading: "Out for Delivery Orders",
    status: "Out for delivery",
  },
  { key: "cancelled", title: "Cancelled Orders", heading: "Cancelled Orders", status: "Cancelled" },
  { key: "revenue", title: "Total Revenue", heading: "Revenue Orders", status: "" },
];

const getLocalDateKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayLocalDateKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatSelectedDate = (dateKey) => {
  if (!dateKey) {
    return "";
  }
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const orderMatchesSearch = (order, term) => {
  if (!term) {
    return true;
  }

  const normalizedTerm = term.toLowerCase();
  const fields = [
    order?.customerName || "",
    order?.phone || "",
    order?.orderId || "",
    order?.addressText || order?.address || "",
    ...(Array.isArray(order?.items)
      ? order.items.map((item) => getOrderItemName(item) || "")
      : []),
  ];

  return fields.some((value) =>
    String(value).toLowerCase().includes(normalizedTerm)
  );
};

const isOrderExpiredError = (error) =>
  getErrorMessage(error, "")
    .toLowerCase()
    .includes("confirmation time expired");

const getAppStatusFromResponse = (response) => {
  const source = response?.data?.data || response?.data || {};
  return {
    isActive: source?.isActive !== false,
    message: source?.message || "",
  };
};

export default function Dashboard() {
  const {
    orders,
    ordersLoading,
    ordersRefreshing,
    ordersError,
    refreshOrders,
    retryOrdersLoad,
    orderStats,
    orderStatsLoading,
    setOrdersFilters,
    ordersFilters,
    updateOrderStatus,
    addToast,
  } = useOutletContext();

  const [activeTab, setActiveTab] = useState("total");
  const [searchInput, setSearchInput] = useState(ordersFilters.search || "");
  const [debouncedSearchInput, setDebouncedSearchInput] = useState(
    ordersFilters.search || ""
  );
  const [selectedOrderDate, setSelectedOrderDate] = useState("");
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [outForDeliveryLoading, setOutForDeliveryLoading] = useState(false);
  const [appStatusLoading, setAppStatusLoading] = useState(true);
  const [appStatusUpdating, setAppStatusUpdating] = useState(false);
  const [appStatusConfirmOpen, setAppStatusConfirmOpen] = useState(false);
  const [appStatus, setAppStatus] = useState({
    isActive: true,
    message: "Daawat is accepting orders",
  });
  const dateInputRef = useRef(null);

  const activeTabConfig = useMemo(
    () => DASHBOARD_TABS.find((tab) => tab.key === activeTab) || DASHBOARD_TABS[0],
    [activeTab]
  );

  useEffect(() => {
    setOrdersFilters((prev) => ({
      ...prev,
      status: "",
      search: "",
      limit: DASHBOARD_LIMIT,
    }));
  }, [setOrdersFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchInput(searchInput);
    }, DASHBOARD_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

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

  const dateFilteredOrders = useMemo(() => {
    const withoutExpired = orders.filter(
      (order) => (order?.status || order?.orderStatus) !== "Expired"
    );
    if (!selectedOrderDate) {
      return withoutExpired;
    }
    return withoutExpired.filter(
      (order) => getLocalDateKey(order?.createdAt) === selectedOrderDate
    );
  }, [orders, selectedOrderDate]);

  const dateScopedStats = useMemo(() => {
    return dateFilteredOrders.reduce(
      (acc, order) => {
        const status = order?.status || order?.orderStatus;
        acc.totalOrders += 1;

        if (status === "Accepted") {
          acc.acceptedOrders += 1;
        }
        if (status === "Out for delivery") {
          acc.outForDeliveryOrders += 1;
        }
        if (status === "Cancelled") {
          acc.cancelledOrders += 1;
        }
        if (status === "Out for delivery" || status === "Delivered") {
          acc.totalRevenue += Number(order?.total || 0);
        }
        return acc;
      },
      {
        totalOrders: 0,
        acceptedOrders: 0,
        outForDeliveryOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
      }
    );
  }, [dateFilteredOrders]);

  const tabFilteredOrders = useMemo(() => {
    if (activeTab === "accepted") {
      return dateFilteredOrders.filter((order) => order?.status === "Accepted");
    }
    if (activeTab === "out_for_delivery") {
      return dateFilteredOrders.filter(
        (order) => order?.status === "Out for delivery"
      );
    }
    if (activeTab === "cancelled") {
      return dateFilteredOrders.filter((order) => order?.status === "Cancelled");
    }
    if (activeTab === "revenue") {
      return dateFilteredOrders.filter((order) =>
        ["Out for delivery", "Delivered"].includes(order?.status)
      );
    }
    return dateFilteredOrders;
  }, [activeTab, dateFilteredOrders]);

  const debouncedSearch = useMemo(
    () => debouncedSearchInput.trim().toLowerCase(),
    [debouncedSearchInput]
  );
  const ordersForActiveTab = useMemo(
    () => tabFilteredOrders.filter((order) => orderMatchesSearch(order, debouncedSearch)),
    [debouncedSearch, tabFilteredOrders]
  );

  const handleMarkOutForDelivery = async () => {
    if (!selectedOrderForModal) {
      return;
    }

    try {
      setOutForDeliveryLoading(true);
      await updateOrderStatus(selectedOrderForModal, "Out for delivery", {
        successMessage: `Order #${
          selectedOrderForModal.orderId || getOrderIdentifier(selectedOrderForModal)
        } moved to Out for delivery.`,
      });
      setSelectedOrderForModal(null);
    } catch (error) {
      if (isOrderExpiredError(error)) {
        setSelectedOrderForModal(null);
        await refreshOrders();
      }
      addToast({
        title: "Update failed",
        message: getErrorMessage(error, "Unable to mark out for delivery"),
        type: "error",
      });
    } finally {
      setOutForDeliveryLoading(false);
    }
  };

  const handleAcceptPlacedOrder = async () => {
    if (!selectedOrderForModal) {
      return;
    }

    try {
      setStatusActionLoading(true);
      await updateOrderStatus(selectedOrderForModal, "Accepted", {
        successMessage: `Order #${
          selectedOrderForModal.orderId || getOrderIdentifier(selectedOrderForModal)
        } accepted successfully.`,
      });
      setSelectedOrderForModal(null);
    } catch (error) {
      if (isOrderExpiredError(error)) {
        setSelectedOrderForModal(null);
        await refreshOrders();
      }
      addToast({
        title: "Update failed",
        message: getErrorMessage(error, "Unable to accept order"),
        type: "error",
      });
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleRejectPlacedOrder = async () => {
    if (!selectedOrderForModal) {
      return;
    }

    try {
      setStatusActionLoading(true);
      await updateOrderStatus(selectedOrderForModal, "Cancelled", {
        successMessage: `Order #${
          selectedOrderForModal.orderId || getOrderIdentifier(selectedOrderForModal)
        } rejected successfully.`,
      });
      setSelectedOrderForModal(null);
    } catch (error) {
      if (isOrderExpiredError(error)) {
        setSelectedOrderForModal(null);
        await refreshOrders();
      }
      addToast({
        title: "Update failed",
        message: getErrorMessage(error, "Unable to reject order"),
        type: "error",
      });
    } finally {
      setStatusActionLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedOrderForModal) {
      return;
    }

    const selectedId = getOrderIdentifier(selectedOrderForModal);
    if (!selectedId) {
      return;
    }

    const latestOrder = orders.find(
      (order) => getOrderIdentifier(order) === selectedId
    );
    if (!latestOrder) {
      setSelectedOrderForModal(null);
      return;
    }

    const latestStatus = latestOrder.status || latestOrder.orderStatus;
    if (latestStatus === "Expired") {
      setSelectedOrderForModal(null);
      return;
    }

    if (latestOrder !== selectedOrderForModal) {
      setSelectedOrderForModal(latestOrder);
    }
  }, [orders, selectedOrderForModal]);

  const getCancelledLabel = (order) => {
    const cancelledBy = String(order?.cancelledBy || "").toLowerCase();
    if (cancelledBy === "customer") {
      return "Cancelled by Customer";
    }
    if (cancelledBy === "owner") {
      return "Rejected by Owner";
    }
    return "Cancelled";
  };

  const stats = orderStats || {};
  const effectiveStats = selectedOrderDate
    ? dateScopedStats
    : {
        totalOrders: stats.totalOrders || 0,
        acceptedOrders: stats.acceptedOrders || 0,
        outForDeliveryOrders: stats.outForDeliveryOrders || 0,
        cancelledOrders: stats.cancelledOrders || 0,
        totalRevenue: stats.totalRevenue || 0,
      };

  const openDatePicker = () => {
    if (!dateInputRef.current) {
      return;
    }
    if (typeof dateInputRef.current.showPicker === "function") {
      dateInputRef.current.showPicker();
      return;
    }
    dateInputRef.current.click();
  };

  const handleDateChange = (event) => {
    const selected = event.target.value;
    const today = getTodayLocalDateKey();

    if (selected && selected > today) {
      addToast({
        title: "Invalid date",
        message: "Future dates are not available",
        type: "error",
      });
      return;
    }

    setSelectedOrderDate(selected);
  };

  const updateAppStatus = async (isActive) => {
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
  };

  const handleAppStatusToggle = () => {
    if (appStatusLoading || appStatusUpdating) {
      return;
    }

    if (appStatus.isActive) {
      setAppStatusConfirmOpen(true);
      return;
    }

    void updateAppStatus(true);
  };

  const confirmMakeInactive = () => {
    setAppStatusConfirmOpen(false);
    void updateAppStatus(false);
  };

  return (
    <div className="page-stack">
      <div className="page-actions">
        <h2>Overview</h2>
        <div className="orders-actions">
          <div
            className={`app-status-control ${appStatus.isActive ? "active" : "inactive"} ${
              appStatusLoading ? "loading" : ""
            }`}
          >
            <div className="app-status-text">
              <span>App Status</span>
              <strong>
                {appStatusLoading
                  ? "Checking status..."
                  : appStatus.isActive
                    ? "App Active"
                    : "App Inactive"}
              </strong>
            </div>
            <button
              type="button"
              className="app-status-switch"
              onClick={handleAppStatusToggle}
              disabled={appStatusLoading || appStatusUpdating}
              aria-pressed={appStatus.isActive}
            >
              <span className={`app-status-track ${appStatus.isActive ? "on" : "off"}`}>
                <span className="app-status-thumb" />
              </span>
              <span className="app-status-value">
                {appStatusUpdating ? "Updating..." : appStatus.isActive ? "Active" : "Inactive"}
              </span>
            </button>
          </div>

          <div className="date-filter-controls">
            <button
              type="button"
              className="btn ghost calendar-btn"
              onClick={openDatePicker}
              aria-label="Filter by date"
              title="Filter by date"
            >
              📅
            </button>
            <input
              ref={dateInputRef}
              className="date-filter-input"
              type="date"
              max={getTodayLocalDateKey()}
              value={selectedOrderDate}
              onChange={handleDateChange}
            />
            {selectedOrderDate ? (
              <>
                <span className="selected-date-label">
                  Selected Date: {formatSelectedDate(selectedOrderDate)}
                </span>
                <button
                  type="button"
                  className="btn ghost show-all-btn"
                  onClick={() => setSelectedOrderDate("")}
                >
                  Show All
                </button>
              </>
            ) : null}
          </div>
          <button className="btn" onClick={() => void refreshOrders()}>
            Refresh Orders
          </button>
        </div>
      </div>

      <div className="stats-grid dashboard-tabs-grid">
        <StatCard
          title="Total Orders"
          value={orderStatsLoading && !selectedOrderDate ? "..." : effectiveStats.totalOrders}
          active={activeTab === "total"}
          onClick={() => setActiveTab("total")}
        />
        <StatCard
          title="Accepted Orders"
          value={
            orderStatsLoading && !selectedOrderDate ? "..." : effectiveStats.acceptedOrders
          }
          active={activeTab === "accepted"}
          onClick={() => setActiveTab("accepted")}
        />
        <StatCard
          title="Out for Delivery"
          value={
            orderStatsLoading && !selectedOrderDate
              ? "..."
              : effectiveStats.outForDeliveryOrders
          }
          tone="gold"
          active={activeTab === "out_for_delivery"}
          onClick={() => setActiveTab("out_for_delivery")}
        />
        <StatCard
          title="Cancelled Orders"
          value={
            orderStatsLoading && !selectedOrderDate ? "..." : effectiveStats.cancelledOrders
          }
          active={activeTab === "cancelled"}
          onClick={() => setActiveTab("cancelled")}
        />
        <StatCard
          title="Total Revenue"
          value={
            orderStatsLoading && !selectedOrderDate
              ? "..."
              : formatCurrency(effectiveStats.totalRevenue)
          }
          tone="accent"
          active={activeTab === "revenue"}
          onClick={() => setActiveTab("revenue")}
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{activeTabConfig.heading}</h3>
          {ordersRefreshing && <p className="muted">Refreshing orders...</p>}
        </div>

        <div className="orders-filters single">
          <input
            className="orders-search-input"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by customer name, mobile number, order ID, address, or dish name..."
          />
        </div>

        {ordersLoading && ordersForActiveTab.length === 0 ? (
          <div className="orders-skeleton-grid">
            <div className="orders-skeleton-card" />
            <div className="orders-skeleton-card" />
            <div className="orders-skeleton-card" />
          </div>
        ) : ordersError && ordersForActiveTab.length === 0 ? (
          <div className="error-panel">
            <p className="error-msg">Unable to load orders. Please retry.</p>
            <button className="btn ghost" onClick={() => void retryOrdersLoad()}>
              Retry
            </button>
          </div>
        ) : ordersForActiveTab.length === 0 ? (
          <p className="muted">No orders found for this tab.</p>
        ) : (
          <div className="orders-grid">
            {ordersForActiveTab.map((order) => {
              const orderId = getOrderIdentifier(order);
              const isCancelled = order?.status === "Cancelled";
              const canOpenModal = Boolean(orderId);

              return (
                <article
                  key={orderId}
                  className={`order-card dashboard-order-card ${
                    canOpenModal ? "clickable" : ""
                  } ${isCancelled ? "cancelled-order-card" : ""}`}
                  onClick={() => {
                    if (canOpenModal) {
                      setSelectedOrderForModal(order);
                    }
                  }}
                >
                  <div className="order-head">
                    <div>
                      <h3>Order #{order?.orderId || orderId}</h3>
                      <p>{formatDateTime(order?.createdAt)}</p>
                    </div>
                    <div className="order-status-badge">{order?.status}</div>
                  </div>
                  {isCancelled && (
                    <p className="cancelled-order-label">{getCancelledLabel(order)}</p>
                  )}

                  <div className="order-grid">
                    <p>
                      <span>Customer:</span> {order?.customerName}
                    </p>
                    <p>
                      <span>Phone:</span> {order?.phone}
                    </p>
                    <p>
                      <span>Address:</span> {order?.addressText || order?.address}
                    </p>
                    <p>
                      <span>Total:</span> {formatCurrency(order?.total)}
                    </p>
                    <p>
                      <span>Payment:</span> {order?.paymentMethod}
                    </p>
                    <p>
                      <span>Payment Status:</span> {order?.paymentStatus}
                    </p>
                    {order?.latitude && order?.longitude && (
                      <p>
                        <a
                          className="map-btn"
                          href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Open Location
                        </a>
                      </p>
                    )}
                  </div>

                  <div className="order-items">
                    <h4>Items</h4>
                    {order?.items?.length ? (
                      <ul>
                        {order.items.map((item, idx) => (
                          <li key={`${item?.itemId || item?._id || idx}`}>
                            <div className="order-item-main">
                              <strong>{getOrderItemName(item)}</strong>
                              <span>
                                Qty: {item?.quantity || item?.qty || 1} x{" "}
                                {formatCurrency(
                                  item?.price ||
                                    item?.unitPrice ||
                                    item?.menuItem?.price ||
                                    0
                                )}
                              </span>
                              {(item?.itemId || item?._id) && (
                                <small>Item ID: {String(item?.itemId || item?._id)}</small>
                              )}
                            </div>
                            <span className="order-item-line-total">
                              {formatCurrency(
                                (item?.quantity || item?.qty || 1) *
                                  (item?.price ||
                                    item?.unitPrice ||
                                    item?.menuItem?.price ||
                                    0)
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No items found</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedOrderForModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-large">
            <div className="modal-order-head">
              <h3>Order Details</h3>
              <button
                className="btn ghost"
                onClick={() => setSelectedOrderForModal(null)}
                disabled={outForDeliveryLoading || statusActionLoading}
              >
                Close
              </button>
            </div>

            <div className="modal-order-grid">
              <p>
                <span>Order ID:</span> #{selectedOrderForModal.orderId || getOrderIdentifier(selectedOrderForModal)}
              </p>
              <p>
                <span>Customer:</span> {selectedOrderForModal.customerName}
              </p>
              <p>
                <span>Phone:</span> {selectedOrderForModal.phone}
              </p>
              <p>
                <span>Address:</span> {selectedOrderForModal.addressText || selectedOrderForModal.address}
              </p>
              <p>
                <span>Subtotal:</span> {formatCurrency(selectedOrderForModal.subtotal)}
              </p>
              <p>
                <span>Tax:</span> {formatCurrency(selectedOrderForModal.tax)}
              </p>
              <p>
                <span>Delivery Fee:</span> {formatCurrency(selectedOrderForModal.deliveryFee)}
              </p>
              <p>
                <span>Total:</span> {formatCurrency(selectedOrderForModal.total)}
              </p>
              <p>
                <span>Payment Method:</span> {selectedOrderForModal.paymentMethod}
              </p>
              <p>
                <span>Payment Status:</span> {selectedOrderForModal.paymentStatus}
              </p>
              <p>
                <span>Order Status:</span> {selectedOrderForModal.status}
              </p>
              <p>
                <span>Created:</span> {formatDateTime(selectedOrderForModal.createdAt)}
              </p>
              {selectedOrderForModal.latitude && selectedOrderForModal.longitude && (
                <p>
                  <a
                    className="map-btn"
                    href={`https://www.google.com/maps?q=${selectedOrderForModal.latitude},${selectedOrderForModal.longitude}`}
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
              {selectedOrderForModal.items?.length ? (
                <ul>
                  {selectedOrderForModal.items.map((item, idx) => (
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
              {(selectedOrderForModal.status || selectedOrderForModal.orderStatus) ===
                "Placed" && (
                <>
                  <button
                    className="btn danger"
                    onClick={() => void handleRejectPlacedOrder()}
                    disabled={statusActionLoading}
                  >
                    {statusActionLoading ? "Please wait..." : "Reject"}
                  </button>
                  <button
                    className="btn success"
                    onClick={() => void handleAcceptPlacedOrder()}
                    disabled={statusActionLoading}
                  >
                    {statusActionLoading ? "Please wait..." : "Accept"}
                  </button>
                </>
              )}
              {(selectedOrderForModal.status || selectedOrderForModal.orderStatus) ===
                "Accepted" && (
                <button
                  className="btn"
                  onClick={() => void handleMarkOutForDelivery()}
                  disabled={outForDeliveryLoading}
                >
                  {outForDeliveryLoading ? "Please wait..." : "Out for Delivery"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

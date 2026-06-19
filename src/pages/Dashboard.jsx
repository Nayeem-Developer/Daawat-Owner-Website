import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import StatCard from "../components/StatCard";
import api, { getErrorMessage } from "../services/api";
import {
  computeOrderStats,
  formatCurrency,
  formatDateTime,
  getDisplayOrderStatus,
  getOrderActionButtons,
  getOrderIdentifier,
  getOrderItemName,
  isCancelledOrder,
  isExpiredOrder,
  matchesOrderFilter,
} from "../services/formatters";

const DASHBOARD_SEARCH_DEBOUNCE_MS = 300;
const DASHBOARD_LIMIT = 100;
const DELETE_ALL_ORDERS_CONFIRM_TEXT = "DELETE ALL ORDERS";

const DASHBOARD_TABS = [
  { key: "total", title: "Total Orders", heading: "All Orders", status: "" },
  { key: "pending", title: "Pending Orders", heading: "Pending Orders", status: "pending" },
  { key: "accepted", title: "Accepted Orders", heading: "Accepted Orders", status: "Accepted" },
  {
    key: "out_for_delivery",
    title: "Out for Delivery",
    heading: "Out for Delivery Orders",
    status: "Out for delivery",
  },
  { key: "delivered", title: "Delivered Orders", heading: "Delivered Orders", status: "Delivered" },
  { key: "cancelled", title: "Cancelled Orders", heading: "Cancelled Orders", status: "Cancelled" },
];

const getActionSuccessMessage = (order, nextStatus) => {
  const orderCode = order?.orderId || getOrderIdentifier(order);

  if (nextStatus === "Accepted") {
    return `Order #${orderCode} accepted successfully.`;
  }

  if (nextStatus === "Cancelled") {
    return `Order #${orderCode} rejected successfully.`;
  }

  if (nextStatus === "Out for delivery") {
    return `Order #${orderCode} moved to Out for Delivery.`;
  }

  if (nextStatus === "Delivered") {
    return `Order #${orderCode} marked as delivered.`;
  }

  return `Order #${orderCode} updated successfully.`;
};

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
    clearOrdersAndRevenueState,
  } = useOutletContext();

  const [activeTab, setActiveTab] = useState("total");
  const [searchInput, setSearchInput] = useState(ordersFilters.search || "");
  const [debouncedSearchInput, setDebouncedSearchInput] = useState(
    ordersFilters.search || ""
  );
  const [selectedOrderDate, setSelectedOrderDate] = useState("");
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [pendingAction, setPendingAction] = useState({
    orderId: "",
    status: "",
  });
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState("");
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
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

  const dateFilteredOrders = useMemo(() => {
    const withoutExpired = orders.filter(
      (order) => !isExpiredOrder(order)
    );
    if (!selectedOrderDate) {
      return withoutExpired;
    }
    return withoutExpired.filter(
      (order) => getLocalDateKey(order?.createdAt) === selectedOrderDate
    );
  }, [orders, selectedOrderDate]);

  const dateScopedStats = useMemo(
    () => computeOrderStats(dateFilteredOrders),
    [dateFilteredOrders]
  );

  const localStats = useMemo(() => computeOrderStats(orders), [orders]);

  const tabFilteredOrders = useMemo(() => {
    if (activeTab === "total") {
      return dateFilteredOrders;
    }

    return dateFilteredOrders.filter((order) => matchesOrderFilter(order, activeTab));
  }, [activeTab, dateFilteredOrders]);

  const debouncedSearch = useMemo(
    () => debouncedSearchInput.trim().toLowerCase(),
    [debouncedSearchInput]
  );
  const ordersForActiveTab = useMemo(
    () => tabFilteredOrders.filter((order) => orderMatchesSearch(order, debouncedSearch)),
    [debouncedSearch, tabFilteredOrders]
  );

  const handleOrderStatusAction = async (
    order,
    nextStatus,
    { closeModalOnSuccess = false } = {}
  ) => {
    const orderId = getOrderIdentifier(order);

    if (!orderId || pendingAction.orderId) {
      return;
    }

    try {
      setPendingAction({ orderId, status: nextStatus });
      await updateOrderStatus(order, nextStatus, {
        successMessage: getActionSuccessMessage(order, nextStatus),
      });

      if (closeModalOnSuccess) {
        setSelectedOrderForModal(null);
      }

      await refreshOrders();
    } catch (error) {
      if (isOrderExpiredError(error)) {
        if (closeModalOnSuccess) {
          setSelectedOrderForModal(null);
        }
        await refreshOrders();
      }

      addToast({
        title: "Update failed",
        message: getErrorMessage(error, "Unable to update order status"),
        type: "error",
      });
    } finally {
      setPendingAction({ orderId: "", status: "" });
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
    if (isExpiredOrder(latestStatus)) {
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
  const getNumericStat = (...values) => {
    const nextValue = values.find(
      (value) => typeof value === "number" && Number.isFinite(value)
    );

    return nextValue ?? 0;
  };
  const effectiveStats = selectedOrderDate
    ? dateScopedStats
    : {
        totalOrders: getNumericStat(stats.totalOrders, localStats.totalOrders),
        pendingOrders: getNumericStat(
          stats.pendingOrders,
          stats.placedOrders,
          localStats.pendingOrders
        ),
        acceptedOrders: getNumericStat(stats.acceptedOrders, localStats.acceptedOrders),
        outForDeliveryOrders: getNumericStat(
          stats.outForDeliveryOrders,
          localStats.outForDeliveryOrders
        ),
        deliveredOrders: getNumericStat(
          stats.deliveredOrders,
          localStats.deliveredOrders
        ),
        cancelledOrders: getNumericStat(
          stats.cancelledOrders,
          localStats.cancelledOrders
        ),
        totalRevenue: getNumericStat(stats.totalRevenue, localStats.totalRevenue),
      };

  const deleteConfirmationMatched =
    deleteAllConfirmText === DELETE_ALL_ORDERS_CONFIRM_TEXT;
  const canDeleteOrders =
    deleteAllPassword.trim().length > 0 && deleteConfirmationMatched && !deleteAllLoading;

  const closeDeleteAllModal = (force = false) => {
    if (deleteAllLoading && !force) {
      return;
    }
    setDeleteAllModalOpen(false);
    setDeleteAllPassword("");
    setDeleteAllConfirmText("");
  };

  const handleDeleteAllOrders = async () => {
    const password = deleteAllPassword.trim();
    if (!password || !deleteConfirmationMatched || deleteAllLoading) {
      return;
    }

    try {
      setDeleteAllLoading(true);
      await api.delete("/api/owner/orders/clear-all", {
        data: {
          password,
          confirmText: DELETE_ALL_ORDERS_CONFIRM_TEXT,
        },
      });

      clearOrdersAndRevenueState();
      closeDeleteAllModal(true);
      await refreshOrders();
      addToast({
        title: "Success",
        message: "All orders and revenue data deleted successfully",
        type: "success",
      });
    } catch (error) {
      addToast({
        title: "Delete failed",
        message: getErrorMessage(error, "Failed to delete orders"),
        type: "error",
      });
    } finally {
      setDeleteAllLoading(false);
    }
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

  return (
    <div className="page-stack">
      <div className="page-actions">
        <h2>Overview</h2>
        <div className="orders-actions">
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
          title="Pending Orders"
          value={orderStatsLoading && !selectedOrderDate ? "..." : effectiveStats.pendingOrders}
          active={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
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
          title="Delivered Orders"
          value={
            orderStatsLoading && !selectedOrderDate ? "..." : effectiveStats.deliveredOrders
          }
          tone="green"
          active={activeTab === "delivered"}
          onClick={() => setActiveTab("delivered")}
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
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{activeTabConfig.heading}</h3>
          <div className="panel-head-actions">
            {ordersRefreshing && <p className="muted">Refreshing orders...</p>}
            {activeTab === "total" && (
              <button
                type="button"
                className="btn danger delete-all-orders-btn"
                onClick={() => setDeleteAllModalOpen(true)}
              >
                <span className="delete-all-orders-icon" aria-hidden="true">
                  !
                </span>
                <span>Delete All Orders</span>
              </button>
            )}
          </div>
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
              const isCancelled = isCancelledOrder(order);
              const canOpenModal = Boolean(orderId);
              const orderActions = getOrderActionButtons(order);
              const actionLoadingStatus =
                pendingAction.orderId === orderId ? pendingAction.status : "";

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
                    <div className="order-status-badge">{getDisplayOrderStatus(order)}</div>
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

                  {orderActions.length > 0 ? (
                    <div className="order-card-actions action-row">
                      {orderActions.map((action) => {
                        const buttonClass =
                          action.variant === "danger"
                            ? "btn danger"
                            : action.variant === "success"
                              ? "btn success"
                              : "btn";

                        return (
                          <button
                            key={action.key}
                            type="button"
                            className={buttonClass}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleOrderStatusAction(order, action.nextStatus);
                            }}
                            disabled={Boolean(pendingAction.orderId)}
                          >
                            {actionLoadingStatus === action.nextStatus
                              ? "Please wait..."
                              : action.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {deleteAllModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card delete-all-orders-modal">
            <div className="delete-all-orders-modal-head">
              <span className="delete-all-orders-modal-icon" aria-hidden="true">
                !
              </span>
              <div>
                <h3>Delete all orders?</h3>
                <p>
                  This will permanently delete all order details and reset revenue data.
                  Menu items, categories, banners, and app settings will not be deleted.
                </p>
              </div>
            </div>

            <p className="delete-all-orders-modal-warning">
              Type {DELETE_ALL_ORDERS_CONFIRM_TEXT} to confirm.
            </p>

            <div className="form-grid delete-all-orders-modal-form">
              <label>
                Owner Password
                <input
                  type="password"
                  value={deleteAllPassword}
                  onChange={(event) => setDeleteAllPassword(event.target.value)}
                  placeholder="Enter owner password"
                  autoComplete="current-password"
                  disabled={deleteAllLoading}
                />
              </label>

              <label>
                Confirmation Text
                <input
                  type="text"
                  value={deleteAllConfirmText}
                  onChange={(event) => setDeleteAllConfirmText(event.target.value)}
                  placeholder="Type DELETE ALL ORDERS"
                  disabled={deleteAllLoading}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={() => closeDeleteAllModal()}
                disabled={deleteAllLoading}
              >
                Cancel
              </button>
              <button
                className="btn danger delete-all-orders-confirm-btn"
                onClick={() => void handleDeleteAllOrders()}
                disabled={!canDeleteOrders}
              >
                {deleteAllLoading ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderForModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-large">
            <div className="modal-order-head">
              <h3>Order Details</h3>
              <button
                className="btn ghost"
                onClick={() => setSelectedOrderForModal(null)}
                disabled={
                  pendingAction.orderId === getOrderIdentifier(selectedOrderForModal)
                }
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
                <span>Order Status:</span> {getDisplayOrderStatus(selectedOrderForModal)}
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

            <div className="modal-actions order-modal-actions">
              {getOrderActionButtons(selectedOrderForModal).map((action) => {
                const isLoading =
                  pendingAction.orderId === getOrderIdentifier(selectedOrderForModal) &&
                  pendingAction.status === action.nextStatus;
                const buttonClass =
                  action.variant === "danger"
                    ? "btn danger"
                    : action.variant === "success"
                      ? "btn success"
                      : "btn";
                const modalLabel =
                  action.nextStatus === "Accepted"
                    ? "Accept Order"
                    : action.nextStatus === "Cancelled"
                      ? "Reject Order"
                      : action.nextStatus === "Out for delivery"
                        ? "Mark Out for Delivery"
                        : action.nextStatus === "Delivered"
                          ? "Mark Delivered"
                          : action.label;

                return (
                  <button
                    key={action.key}
                    className={buttonClass}
                    onClick={() =>
                      void handleOrderStatusAction(selectedOrderForModal, action.nextStatus, {
                        closeModalOnSuccess: true,
                      })
                    }
                    disabled={Boolean(pendingAction.orderId)}
                  >
                    {isLoading ? "Please wait..." : modalLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

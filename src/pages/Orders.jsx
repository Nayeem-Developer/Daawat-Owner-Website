import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import OrderCard from "../components/OrderCard";
import {
  getOrderIdentifier,
  matchesOrderFilter,
} from "../services/formatters";

const ORDER_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;
const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending Orders" },
  { value: "accepted", label: "Accepted Orders" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered Orders" },
  { value: "cancelled", label: "Cancelled Orders" },
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

export default function Orders() {
  const {
    orders,
    ordersLoading,
    ordersRefreshing,
    ordersError,
    ordersPagination,
    ordersFilters,
    setOrdersFilters,
    refreshOrders,
    loadMoreOrders,
    hasMoreOrders,
    highlightedOrderId,
    updateOrderStatus,
    addToast,
  } = useOutletContext();

  const [searchInput, setSearchInput] = useState(ordersFilters.search || "");
  const [isViewCleared, setIsViewCleared] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState({
    orderId: "",
    status: "",
  });

  useEffect(() => {
    setOrdersFilters((prev) => ({
      ...prev,
      status: "",
      limit: ORDER_LIMIT,
    }));
  }, [setOrdersFilters]);

  useEffect(() => {
    setSearchInput(ordersFilters.search || "");
  }, [ordersFilters.search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setOrdersFilters((prev) => ({
        ...prev,
        search: searchInput,
        limit: ORDER_LIMIT,
      }));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, setOrdersFilters]);

  const handleClearOrdersView = () => {
    const shouldClear = window.confirm(
      "Clear orders from this page view? This will not delete orders from database."
    );
    if (!shouldClear) {
      return;
    }
    setIsViewCleared(true);
  };

  const handleRefreshOrders = async () => {
    setIsViewCleared(false);
    await refreshOrders();
  };

  const visibleOrders = useMemo(() => {
    if (isViewCleared) {
      return [];
    }
    return orders.filter((order) => matchesOrderFilter(order, statusFilter));
  }, [isViewCleared, orders, statusFilter]);

  const handleOrderAction = async (order, nextStatus) => {
    const orderId = getOrderIdentifier(order);
    if (!orderId || pendingAction.orderId) {
      return;
    }

    try {
      setPendingAction({ orderId, status: nextStatus });
      await updateOrderStatus(order, nextStatus, {
        successMessage: getActionSuccessMessage(order, nextStatus),
      });
      await refreshOrders();
    } catch (error) {
      addToast({
        title: "Update failed",
        message: error?.message || "Unable to update order status",
        type: "error",
      });
    } finally {
      setPendingAction({ orderId: "", status: "" });
    }
  };

  return (
    <div className="page-stack">
      <div className="page-actions">
        <h2>Orders</h2>
        <div className="orders-actions">
          <button className="btn ghost" onClick={handleClearOrdersView}>
            Clear
          </button>
          <button className="btn" onClick={() => void handleRefreshOrders()}>
            Refresh Orders
          </button>
        </div>
      </div>

      <div className="panel orders-filters-panel">
        <div className="orders-filters">
          <input
            className="orders-search-input"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by customer name, mobile number, order ID, address, or dish name..."
          />

          <select
            className="orders-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {ordersLoading && visibleOrders.length === 0 ? (
        <div className="panel">
          <div className="orders-skeleton-grid">
            <div className="orders-skeleton-card" />
            <div className="orders-skeleton-card" />
            <div className="orders-skeleton-card" />
          </div>
        </div>
      ) : (
        <>
          {ordersError && (
            <div className="panel error-panel">
              <p className="error-msg">Unable to load orders. Please retry.</p>
              <button className="btn ghost" onClick={handleClearOrdersView}>
                Clear
              </button>
            </div>
          )}

          {visibleOrders.length === 0 ? (
            <div className="panel">
              <p className="muted">
                {isViewCleared
                  ? "Orders are cleared from this page view. Click Refresh to load again."
                  : "No matching orders found."}
              </p>
            </div>
          ) : (
            <div className="orders-grid">
              {visibleOrders.map((order) => {
                const orderId = getOrderIdentifier(order);
                return (
                  <OrderCard
                    key={orderId}
                    order={order}
                    readOnly
                    isHighlighted={highlightedOrderId === orderId}
                    onActionClick={handleOrderAction}
                    actionLoadingStatus={
                      pendingAction.orderId === orderId ? pendingAction.status : ""
                    }
                    actionDisabled={Boolean(pendingAction.orderId)}
                  />
                );
              })}
            </div>
          )}

          <div className="orders-footer">
            <p className="muted">
              Page {ordersPagination.page} of {ordersPagination.totalPages || 1} | Total orders:{" "}
              {ordersPagination.total}
            </p>

            {ordersRefreshing ? (
              <p className="muted">Loading latest orders...</p>
            ) : hasMoreOrders && !isViewCleared ? (
              <button className="btn" onClick={loadMoreOrders}>
                Load More
              </button>
            ) : (
              <p className="muted">No more orders to load.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

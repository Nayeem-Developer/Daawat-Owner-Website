import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import OrderCard from "../components/OrderCard";
import { getOrderIdentifier } from "../services/formatters";

const ORDER_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

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
  } = useOutletContext();

  const [searchInput, setSearchInput] = useState(ordersFilters.search || "");
  const [isViewCleared, setIsViewCleared] = useState(false);

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

  const handleStatusFilterChange = (value) => {
    setOrdersFilters((prev) => ({
      ...prev,
      status: value,
      limit: ORDER_LIMIT,
    }));
  };

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
    return orders;
  }, [isViewCleared, orders]);

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
            value={ordersFilters.status}
            onChange={(event) => handleStatusFilterChange(event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Placed">Placed</option>
            <option value="Accepted">Accepted</option>
            <option value="Preparing">Preparing</option>
            <option value="Out for delivery">Out for delivery</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
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

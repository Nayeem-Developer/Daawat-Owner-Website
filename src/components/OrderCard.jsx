import {
  formatCurrency,
  formatDateTime,
  getOrderIdentifier,
  getOrderItemName,
} from "../services/formatters";

export default function OrderCard({
  order,
  onStatusChange,
  isUpdating,
  isHighlighted,
  readOnly = false,
}) {
  const orderId = getOrderIdentifier(order);
  const lat = order?.latitude;
  const lng = order?.longitude;
  const hasMap = lat && lng;

  return (
    <article className={`order-card ${isHighlighted ? "highlight" : ""}`}>
      <div className="order-head">
        <div>
          <h3>Order #{orderId || "N/A"}</h3>
          <p>{formatDateTime(order?.createdAt)}</p>
        </div>
        {readOnly ? (
          <div className="order-status-badge">{order?.status || "Placed"}</div>
        ) : (
          <div className="order-status-wrap">
            <label>Status</label>
            <select
              value={order?.status || "Placed"}
              onChange={(event) => onStatusChange(order, event.target.value)}
              disabled={isUpdating}
            >
              <option value="Placed">Placed</option>
              <option value="Accepted">Accepted</option>
              <option value="Preparing">Preparing</option>
              <option value="Out for delivery">Out for delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      <div className="order-grid">
        <p>
          <span>Customer:</span> {order?.customerName}
        </p>
        <p>
          <span>Phone:</span> {order?.phone}
        </p>
        <p>
          <span>Address:</span> {order?.addressText}
        </p>
        <p>
          <span>Payment:</span> {order?.paymentMethod}
        </p>
        <p>
          <span>Payment Status:</span> {order?.paymentStatus}
        </p>
        {hasMap && (
          <p>
            <a
              className="map-btn"
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Map
            </a>
          </p>
        )}
      </div>

      <div className="order-items">
        <h4>Ordered Items</h4>
        {order?.items?.length ? (
          <ul>
            {order.items.map((item, idx) => (
              <li key={`${item?._id || item?.id || item?.name || "item"}-${idx}`}>
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

      <div className="order-total-row">
        <p>Subtotal: {formatCurrency(order?.subtotal)}</p>
        <p>Tax: {formatCurrency(order?.tax)}</p>
        <p>Delivery: {formatCurrency(order?.deliveryFee)}</p>
        <p>Total: {formatCurrency(order?.total)}</p>
      </div>
    </article>
  );
}

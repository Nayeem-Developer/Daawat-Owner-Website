import { getOrderIdentifier } from "./formatters";

export const getOrderStatusValue = (orderOrStatus) => {
  if (typeof orderOrStatus === "string") {
    return orderOrStatus;
  }

  return orderOrStatus?.status || orderOrStatus?.orderStatus || "";
};

export const isPendingOrderStatus = (orderOrStatus) => {
  const normalized = String(getOrderStatusValue(orderOrStatus) || "").trim().toLowerCase();

  return (
    normalized === "placed" ||
    normalized === "pending" ||
    normalized === "new" ||
    normalized.includes("pending") ||
    normalized.includes("new order")
  );
};

export const getOrderCreatedTimestamp = (order) => {
  const value = order?.createdAt || order?.created_at || order?.date || order?.updatedAt || 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const getPendingOrdersOldestFirst = (orders = []) =>
  orders
    .filter((order) => isPendingOrderStatus(order))
    .slice()
    .sort((left, right) => {
      const timestampDifference = getOrderCreatedTimestamp(left) - getOrderCreatedTimestamp(right);

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      return String(getOrderIdentifier(left)).localeCompare(String(getOrderIdentifier(right)));
    });

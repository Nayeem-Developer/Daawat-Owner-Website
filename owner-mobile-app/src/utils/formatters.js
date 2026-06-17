export const formatCurrency = (value) => {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isNaN(amount) ? 0 : amount);
};

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const getOrderIdentifier = (order) =>
  order?._id || order?.id || order?.orderId || order?.order_id || "";

export const getOrderItemName = (item) =>
  item?.name || item?.menuItem?.name || item?.itemName || "Unknown item";

export const getCustomerName = (order) =>
  order?.customerName ||
  order?.customer?.name ||
  order?.user?.name ||
  order?.name ||
  "N/A";

export const getCustomerPhone = (order) =>
  order?.phone || order?.customer?.phone || order?.user?.phone || "N/A";

export const getAddressText = (order) => {
  if (typeof order?.address === "string") {
    return order.address;
  }

  const address =
    order?.deliveryAddress || order?.address || order?.customer?.address || {};

  const parts = [
    address?.line1,
    address?.line2,
    address?.street,
    address?.landmark,
    address?.city,
    address?.state,
    address?.postalCode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "N/A";
};

export const normalizeOrder = (order) => {
  if (!order || typeof order !== "object") {
    return null;
  }

  const location =
    order?.location ||
    order?.deliveryLocation ||
    order?.address?.location ||
    order?.customer?.location ||
    null;

  return {
    ...order,
    _id: getOrderIdentifier(order),
    items: order?.items || order?.orderItems || [],
    customerName: getCustomerName(order),
    phone: getCustomerPhone(order),
    addressText: getAddressText(order),
    latitude: location?.lat || location?.latitude || null,
    longitude: location?.lng || location?.longitude || null,
    subtotal: order?.subtotal ?? order?.subTotal ?? 0,
    tax: order?.tax ?? 0,
    deliveryFee: order?.deliveryFee ?? order?.delivery_fee ?? 0,
    total: order?.total ?? order?.grandTotal ?? order?.amount ?? 0,
    paymentMethod: order?.paymentMethod || order?.payment?.method || "N/A",
    paymentStatus: order?.paymentStatus || order?.payment?.status || "Pending",
    status: order?.orderStatus || order?.status || "Placed",
    orderStatus: order?.orderStatus || order?.status || "Placed",
    cancelledBy: order?.cancelledBy || order?.cancelled_by || null,
    createdAt: order?.createdAt || order?.created_at || null,
    updatedAt: order?.updatedAt || order?.updated_at || null,
  };
};

export const computeOrderStats = (orders = []) =>
  orders.reduce(
    (stats, order) => {
      const status = String(order?.status || order?.orderStatus || "").toLowerCase();

      stats.totalOrders += 1;

      if (status === "placed") {
        stats.pendingOrders += 1;
      }

      if (status === "accepted") {
        stats.acceptedOrders += 1;
      }

      if (status === "delivered") {
        stats.deliveredOrders += 1;
        stats.totalRevenue += Number(order?.total || 0);
      }

      if (status === "cancelled") {
        stats.cancelledOrders += 1;
      }

      if (status === "out for delivery") {
        stats.outForDeliveryOrders += 1;
      }

      return stats;
    },
    {
      totalOrders: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      outForDeliveryOrders: 0,
      totalRevenue: 0,
    }
  );

export const getListFromResponseBody = (responseBody, keys = []) => {
  const directList = Array.isArray(responseBody?.data)
    ? responseBody.data
    : Array.isArray(responseBody?.items)
      ? responseBody.items
      : Array.isArray(responseBody)
        ? responseBody
        : [];

  if (directList.length > 0) {
    return directList;
  }

  for (const key of keys) {
    if (Array.isArray(responseBody?.[key])) {
      return responseBody[key];
    }

    if (Array.isArray(responseBody?.data?.[key])) {
      return responseBody.data[key];
    }
  }

  return directList;
};

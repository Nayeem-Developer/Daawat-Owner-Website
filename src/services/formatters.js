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

export const getOrderIdentifier = (order) => {
  return order?._id || order?.id || order?.orderId || order?.order_id || "";
};

export const getCustomerName = (order) => {
  return (
    order?.customerName ||
    order?.customer?.name ||
    order?.user?.name ||
    order?.name ||
    "N/A"
  );
};

export const getCustomerPhone = (order) => {
  return order?.phone || order?.customer?.phone || order?.user?.phone || "N/A";
};

export const getAddressText = (order) => {
  if (typeof order?.address === "string") {
    return order.address;
  }

  const addressObj =
    order?.deliveryAddress || order?.address || order?.customer?.address || {};

  const segments = [
    addressObj?.line1,
    addressObj?.line2,
    addressObj?.street,
    addressObj?.landmark,
    addressObj?.city,
    addressObj?.state,
    addressObj?.postalCode,
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(", ") : "N/A";
};

export const getLocation = (order) => {
  return (
    order?.location ||
    order?.deliveryLocation ||
    order?.address?.location ||
    order?.customer?.location ||
    null
  );
};

export const normalizeOrder = (order) => {
  if (!order || typeof order !== "object") {
    return null;
  }

  const location = getLocation(order);

  return {
    ...order,
    _id: getOrderIdentifier(order),
    items: order?.items || order?.orderItems || [],
    customerName: getCustomerName(order),
    phone: getCustomerPhone(order),
    addressText: getAddressText(order),
    location,
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
    cancelledAt: order?.cancelledAt || order?.cancelled_at || null,
    confirmationExpiresAt:
      order?.confirmationExpiresAt || order?.confirmation_expires_at || null,
    expiredAt: order?.expiredAt || order?.expired_at || null,
    expiryReason: order?.expiryReason || order?.expiry_reason || null,
    previousStatus:
      order?.previousStatus || order?.previous_status || order?.oldStatus || null,
    updatedAt: order?.updatedAt || order?.updated_at || null,
    createdAt: order?.createdAt || order?.created_at,
  };
};

export const getOrderItemName = (item) => {
  return item?.name || item?.menuItem?.name || item?.itemName || "Unknown item";
};

export const computeOrderStats = (orders = []) => {
  const stats = {
    totalOrders: orders.length,
    placedOrders: 0,
    acceptedOrders: 0,
    preparingOrders: 0,
    outForDeliveryOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
  };

  for (const order of orders) {
    const status = String(order?.status || "").toLowerCase();

    if (status === "placed") {
      stats.placedOrders += 1;
    }

    if (status === "accepted") {
      stats.acceptedOrders += 1;
    }

    if (status === "preparing") {
      stats.preparingOrders += 1;
    }

    if (status === "out for delivery") {
      stats.outForDeliveryOrders += 1;
    }

    if (status === "delivered") {
      stats.deliveredOrders += 1;
      stats.totalRevenue += Number(order?.total || 0);
    }

    if (status === "cancelled") {
      stats.cancelledOrders += 1;
    }
  }

  return stats;
};

export const ORDER_FILTERS = [
  'All',
  'Pending',
  'Accepted',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

export const normalizeOrderStatus = status =>
  String(status || '')
    .trim()
    .toLowerCase();

export const isPendingOrderStatus = status => {
  const normalized = normalizeOrderStatus(status);
  return (
    normalized === 'placed' ||
    normalized === 'pending' ||
    normalized.includes('pending')
  );
};

export const isAcceptedOrderStatus = status => {
  const normalized = normalizeOrderStatus(status);
  return normalized === 'accepted' || normalized === 'confirmed';
};

export const isOutForDeliveryStatus = status =>
  normalizeOrderStatus(status) === 'out for delivery';

export const isDeliveredOrderStatus = status => {
  const normalized = normalizeOrderStatus(status);
  return normalized === 'delivered' || normalized === 'completed';
};

export const isCancelledOrderStatus = status => {
  const normalized = normalizeOrderStatus(status);
  return (
    normalized.includes('cancel') ||
    normalized.includes('reject') ||
    normalized.includes('expired')
  );
};

export const isTerminalOrderStatus = status =>
  isDeliveredOrderStatus(status) || isCancelledOrderStatus(status);

export const matchesOrderFilter = (order, activeFilter) => {
  if (activeFilter === 'All') {
    return true;
  }

  const status = order?.status || order?.orderStatus;

  if (activeFilter === 'Pending') {
    return isPendingOrderStatus(status);
  }

  if (activeFilter === 'Accepted') {
    return isAcceptedOrderStatus(status);
  }

  if (activeFilter === 'Out for Delivery') {
    return isOutForDeliveryStatus(status);
  }

  if (activeFilter === 'Delivered') {
    return isDeliveredOrderStatus(status);
  }

  if (activeFilter === 'Cancelled') {
    return isCancelledOrderStatus(status);
  }

  return true;
};

export const getOrderActions = status => {
  if (isPendingOrderStatus(status)) {
    return [
      {
        label: 'Accept',
        status: 'Accepted',
        variant: 'success',
        icon: 'check-circle-outline',
      },
      {
        label: 'Reject',
        status: 'Rejected',
        variant: 'danger',
        icon: 'close-circle-outline',
      },
    ];
  }

  if (isAcceptedOrderStatus(status)) {
    return [
      {
        label: 'Out for Delivery',
        status: 'Out for Delivery',
        variant: 'primary',
        icon: 'truck-delivery-outline',
      },
      {
        label: 'Cancel',
        status: 'Cancelled',
        variant: 'ghost',
        icon: 'close-circle-outline',
      },
    ];
  }

  if (isOutForDeliveryStatus(status)) {
    return [
      {
        label: 'Delivered',
        status: 'Delivered',
        variant: 'success',
        icon: 'truck-delivery-outline',
      },
    ];
  }

  return [];
};

export const canTransitionOrder = (orderOrStatus, nextStatus) => {
  const sourceStatus =
    typeof orderOrStatus === 'string'
      ? orderOrStatus
      : orderOrStatus?.status || orderOrStatus?.orderStatus;

  return getOrderActions(sourceStatus).some(
    action => normalizeOrderStatus(action.status) === normalizeOrderStatus(nextStatus),
  );
};

export const getOrderStatusConflictMessage = order => {
  if (isCancelledOrderStatus(order?.status || order?.orderStatus)) {
    return 'This order has already been cancelled.';
  }

  if (isDeliveredOrderStatus(order?.status || order?.orderStatus)) {
    return 'This order has already been delivered.';
  }

  return 'This order status has already changed.';
};

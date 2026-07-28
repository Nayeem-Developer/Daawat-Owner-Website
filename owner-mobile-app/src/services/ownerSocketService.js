import { getOrderIdentifier } from '../utils/formatters';

export const OWNER_SOCKET_ROOM = 'orders:owners';
export const OWNER_SOCKET_JOIN_EVENT = 'auth:join';
export const ORDER_SOCKET_EVENT_NAMES = [
  'order_status_updated',
  'new_order',
  'order_created',
  'order_updated',
  'order:updated',
  'customer_order_cancelled',
  'orders_cleared',
];

export const getOwnerRoomJoinPayload = () => ({
  room: OWNER_SOCKET_ROOM,
});

export const joinOwnerOrderRooms = socket => {
  if (!socket) {
    return;
  }

  const payload = getOwnerRoomJoinPayload();

  socket.emit(OWNER_SOCKET_JOIN_EVENT, payload);
};

export const registerOwnerSocketListeners = (socket, handlers) => {
  const {
    onConnect,
    onDisconnect,
    onConnectError,
    onOrderEvent,
    onAppStatusEvent,
  } = handlers;

  const boundOrderListeners = ORDER_SOCKET_EVENT_NAMES.map(eventName => {
    const listener = payload => {
      onOrderEvent?.(eventName, payload);
    };

    socket.on(eventName, listener);

    if (eventName === 'order_status_updated') {
      console.log('[OWNER_SOCKET] listening order_status_updated');
    }

    return {
      eventName,
      listener,
    };
  });

  if (onConnect) {
    socket.on('connect', onConnect);
  }

  if (onDisconnect) {
    socket.on('disconnect', onDisconnect);
  }

  if (onConnectError) {
    socket.on('connect_error', onConnectError);
  }

  if (onAppStatusEvent) {
    socket.on('app_status_updated', onAppStatusEvent);
  }

  return () => {
    boundOrderListeners.forEach(({ eventName, listener }) => {
      socket.off(eventName, listener);
    });

    if (onConnect) {
      socket.off('connect', onConnect);
    }

    if (onDisconnect) {
      socket.off('disconnect', onDisconnect);
    }

    if (onConnectError) {
      socket.off('connect_error', onConnectError);
    }

    if (onAppStatusEvent) {
      socket.off('app_status_updated', onAppStatusEvent);
    }
  };
};

export const getSafeOrderSocketLog = payload => {
  const source = payload?.order || payload?.data || payload || {};
  const orderId = getOrderIdentifier(source) || 'unknown';
  const status = String(source?.orderStatus || source?.status || 'unknown');

  return `[OWNER_SOCKET] order update received id=${orderId} status=${status}`;
};

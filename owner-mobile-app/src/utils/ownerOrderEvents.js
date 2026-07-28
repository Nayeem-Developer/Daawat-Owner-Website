import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrderIdentifier, normalizeOrder } from './formatters';
import { isCancelledOrderStatus } from './orderStatus';

export const OWNER_ORDER_EVENT_CACHE_KEY = 'ownerProcessedOrderEvents';
export const OWNER_EVENT_CACHE_TTL_MS = 15 * 60 * 1000;
export const OWNER_EVENT_NEW_ORDER = 'new_order';
export const OWNER_EVENT_NEW_ORDER_NOTIFICATION = 'NEW_ORDER';
export const OWNER_EVENT_ORDER_CANCELLED = 'order_cancelled';

const processedOwnerEvents = new Map();
let hasLoadedProcessedOwnerEvents = false;

const sanitizeString = value =>
  value === undefined || value === null ? '' : String(value).trim();

const normalizeEventType = value => sanitizeString(value).toLowerCase();

const pruneProcessedOwnerEvents = (now = Date.now()) => {
  for (const [key, timestamp] of processedOwnerEvents.entries()) {
    if (!timestamp || now - timestamp > OWNER_EVENT_CACHE_TTL_MS) {
      processedOwnerEvents.delete(key);
    }
  }
};

const persistProcessedOwnerEvents = async () => {
  pruneProcessedOwnerEvents();

  try {
    await AsyncStorage.setItem(
      OWNER_ORDER_EVENT_CACHE_KEY,
      JSON.stringify(Array.from(processedOwnerEvents.entries())),
    );
  } catch (error) {
    if (__DEV__) {
      console.log('[owner-events] failed to persist cache', error?.message || error);
    }
  }
};

export const resolveCanonicalMongoOrderId = payload => {
  const sourceData =
    payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const nestedOrder =
    payload?.order && typeof payload.order === 'object'
      ? payload.order
      : sourceData?.order && typeof sourceData.order === 'object'
        ? sourceData.order
        : null;

  return sanitizeString(
    nestedOrder?._id ||
      payload?._id ||
      payload?.id ||
      payload?.mongoOrderId ||
      sourceData?.mongoOrderId ||
      sourceData?.orderId,
  );
};

export const resolveDisplayOrderId = payload => {
  const sourceData =
    payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const nestedOrder =
    payload?.order && typeof payload.order === 'object'
      ? payload.order
      : sourceData?.order && typeof sourceData.order === 'object'
        ? sourceData.order
        : null;

  return sanitizeString(
    sourceData?.displayOrderId ||
      payload?.displayOrderId ||
      nestedOrder?.orderId ||
      payload?.orderId ||
      nestedOrder?._id ||
      payload?._id ||
      payload?.id ||
      payload?.mongoOrderId ||
      sourceData?.mongoOrderId,
  );
};

const buildNormalizedOrderSource = payload => {
  const sourceData =
    payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const nestedOrder =
    sourceData?.order && typeof sourceData.order === 'object'
      ? sourceData.order
      : null;
  const canonicalMongoOrderId = resolveCanonicalMongoOrderId(payload);
  const displayOrderId = resolveDisplayOrderId(payload);

  return {
    ...(nestedOrder || {}),
    _id: canonicalMongoOrderId || nestedOrder?._id,
    id: canonicalMongoOrderId || nestedOrder?.id,
    mongoOrderId: canonicalMongoOrderId || sanitizeString(sourceData?.mongoOrderId),
    orderId: displayOrderId || canonicalMongoOrderId,
    customerName:
      sanitizeString(sourceData?.customerName || nestedOrder?.customerName) || 'Customer',
    phone: sanitizeString(sourceData?.phone || nestedOrder?.phone),
    addressText: sanitizeString(
      sourceData?.addressText || sourceData?.address || nestedOrder?.addressText || nestedOrder?.address,
    ),
    address: sanitizeString(
      sourceData?.address || nestedOrder?.address || nestedOrder?.addressText,
    ),
    total:
      sourceData?.totalAmount ||
      sourceData?.total ||
      nestedOrder?.total ||
      nestedOrder?.amount ||
      0,
    paymentMethod: sanitizeString(
      sourceData?.paymentMethod || nestedOrder?.paymentMethod,
    ),
    status:
      sanitizeString(sourceData?.status || nestedOrder?.status || nestedOrder?.orderStatus) ||
      'Placed',
    orderStatus:
      sanitizeString(sourceData?.status || nestedOrder?.orderStatus || nestedOrder?.status) ||
      'Placed',
    createdAt:
      sanitizeString(sourceData?.createdAt || nestedOrder?.createdAt || nestedOrder?.created_at) ||
      null,
    updatedAt:
      sanitizeString(sourceData?.updatedAt || nestedOrder?.updatedAt || nestedOrder?.updated_at) ||
      sanitizeString(sourceData?.createdAt || nestedOrder?.createdAt || nestedOrder?.created_at) ||
      null,
    cancelledBy: sanitizeString(sourceData?.cancelledBy || nestedOrder?.cancelledBy),
    cancellationReason: sanitizeString(
      sourceData?.cancellationReason || nestedOrder?.cancellationReason,
    ),
    items: Array.isArray(nestedOrder?.items) ? nestedOrder.items : [],
  };
};

export const buildOwnerOrderEventFallbackKey = ({
  orderId = '',
  status = '',
  updatedAt = '',
}) =>
  [sanitizeString(orderId), sanitizeString(status), sanitizeString(updatedAt)]
    .filter(Boolean)
    .join(':');

export const buildOwnerOrderEventKey = ({
  eventId = '',
  orderId = '',
  status = '',
  updatedAt = '',
}) => sanitizeString(eventId) || buildOwnerOrderEventFallbackKey({ orderId, status, updatedAt });

export const normalizeOwnerOrderEvent = payload => {
  const sourceData =
    payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const order = normalizeOrder(buildNormalizedOrderSource(payload));
  const type = sanitizeString(sourceData?.type || payload?.type);
  const eventId = sanitizeString(sourceData?.eventId || payload?.eventId || payload?.messageId);
  const canonicalMongoOrderId = resolveCanonicalMongoOrderId(payload) || getOrderIdentifier(order);
  const displayOrderId = resolveDisplayOrderId(payload) || sanitizeString(order?.orderId);
  const status = sanitizeString(order?.status || order?.orderStatus);
  const updatedAt = sanitizeString(order?.updatedAt || sourceData?.updatedAt || sourceData?.createdAt);
  const dedupeKey = buildOwnerOrderEventKey({
    eventId,
    orderId: canonicalMongoOrderId,
    status,
    updatedAt,
  });

  return {
    canonicalMongoOrderId,
    dedupeKey,
    displayOrderId,
    eventId,
    order,
    orderId: canonicalMongoOrderId,
    raw: payload,
    status,
    type,
    updatedAt,
  };
};

export const isOwnerCancellationEvent = eventOrPayload => {
  const event =
    eventOrPayload?.order || eventOrPayload?.status || eventOrPayload?.type
      ? normalizeOwnerOrderEvent(eventOrPayload)
      : eventOrPayload;

  return (
    normalizeEventType(event?.type) === OWNER_EVENT_ORDER_CANCELLED ||
    isCancelledOrderStatus(event?.status || event?.order?.status || event?.order?.orderStatus)
  );
};

export const isOwnerNewOrderEvent = eventOrPayload => {
  const event =
    eventOrPayload?.order || eventOrPayload?.status || eventOrPayload?.type
      ? normalizeOwnerOrderEvent(eventOrPayload)
      : eventOrPayload;
  const normalizedType = normalizeEventType(event?.type);

  return (
    normalizedType === normalizeEventType(OWNER_EVENT_NEW_ORDER) ||
    normalizedType === normalizeEventType(OWNER_EVENT_NEW_ORDER_NOTIFICATION)
  );
};

export const getShortOrderNumber = order => {
  const orderNumber = sanitizeString(order?.orderId);
  if (orderNumber) {
    return orderNumber;
  }

  const fallbackId = sanitizeString(order?._id || order?.id);
  return fallbackId ? fallbackId.slice(-6) : 'Unknown';
};

export const hydrateProcessedOwnerEvents = async () => {
  if (hasLoadedProcessedOwnerEvents) {
    return processedOwnerEvents;
  }

  hasLoadedProcessedOwnerEvents = true;

  try {
    const rawValue = await AsyncStorage.getItem(OWNER_ORDER_EVENT_CACHE_KEY);

    if (!rawValue) {
      return processedOwnerEvents;
    }

    const parsedEntries = JSON.parse(rawValue);

    if (Array.isArray(parsedEntries)) {
      parsedEntries.forEach(entry => {
        if (!Array.isArray(entry) || entry.length < 2) {
          return;
        }

        const [key, timestamp] = entry;

        if (!sanitizeString(key)) {
          return;
        }

        processedOwnerEvents.set(String(key), Number(timestamp) || 0);
      });
    }

    pruneProcessedOwnerEvents();
  } catch (error) {
    if (__DEV__) {
      console.log('[owner-events] failed to hydrate cache', error?.message || error);
    }
  }

  return processedOwnerEvents;
};

export const hasProcessedOwnerEvent = async eventOrKey => {
  await hydrateProcessedOwnerEvents();
  pruneProcessedOwnerEvents();

  const key =
    typeof eventOrKey === 'string'
      ? sanitizeString(eventOrKey)
      : sanitizeString(eventOrKey?.dedupeKey);

  if (!key) {
    return false;
  }

  return processedOwnerEvents.has(key);
};

export const markOwnerEventProcessed = async eventOrKey => {
  await hydrateProcessedOwnerEvents();

  const key =
    typeof eventOrKey === 'string'
      ? sanitizeString(eventOrKey)
      : sanitizeString(eventOrKey?.dedupeKey);

  if (!key) {
    return '';
  }

  processedOwnerEvents.set(key, Date.now());
  void persistProcessedOwnerEvents();
  return key;
};

export const resetProcessedOwnerEventsForTests = () => {
  processedOwnerEvents.clear();
  hasLoadedProcessedOwnerEvents = false;
};

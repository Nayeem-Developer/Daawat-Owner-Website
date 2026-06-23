import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {
  updateOrderDeliveryLocation,
  updateOrderTrackingStatus,
} from '../api/ownerApi';
import { getOrderIdentifier } from '../utils/formatters';

const LOCATION_PERMISSION_MESSAGE =
  'Location permission is required to share live delivery location.';
const LOCATION_RETRY_WARNING = 'Unable to update live location. Retrying...';
const TRACKING_INTERVAL_MS = 12000;
const TERMINAL_STATUSES = new Set([
  'delivered',
  'rejected',
  'cancelled',
  'completed',
]);
const ACTIVE_TRACKING_STATUS = 'out for delivery';
const listeners = new Set();
const updateCallbacks = new Set();
const errorCallbacks = new Set();

let watchId = null;
let intervalId = null;
let latestLocation = null;
let sendInFlight = false;

const trackingState = {
  active: false,
  orderId: '',
  lastTrackedOrderId: '',
  lastUpdatedAt: null,
  latestLocation: null,
  warning: '',
};

const emitTrackingState = () => {
  const snapshot = { ...trackingState };
  listeners.forEach(listener => {
    listener(snapshot);
  });
  updateCallbacks.forEach(callback => {
    callback(snapshot);
  });
  return snapshot;
};

const setTrackingState = patch => {
  Object.assign(trackingState, patch);
  return emitTrackingState();
};

const getLocationPermission = () =>
  Platform.select({
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    default: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  });

const createTrackingError = (message, code, options = {}) => {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, options);
  return error;
};

const normalizeStatus = status =>
  String(status || '')
    .trim()
    .toLowerCase();

const isTrackableStatus = status =>
  normalizeStatus(status) === ACTIVE_TRACKING_STATUS;

const isTerminalStatus = status =>
  TERMINAL_STATUSES.has(normalizeStatus(status));

const normalizeLocation = position => {
  const coords = position?.coords || {};
  const heading = Number(coords.heading);
  const speed = Number(coords.speed);

  return {
    latitude: Number(coords.latitude),
    longitude: Number(coords.longitude),
    accuracy: Number.isFinite(Number(coords.accuracy))
      ? Number(coords.accuracy)
      : null,
    heading: Number.isFinite(heading) && heading >= 0 ? heading : null,
    speed: Number.isFinite(speed) && speed >= 0 ? speed : null,
  };
};

const hasValidCoordinates = location =>
  Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);

const clearTrackingResources = () => {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }

  Geolocation.stopObserving();

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
        showLocationDialog: true,
        forceRequestLocation: true,
      },
    );
  });

export const requestLocationPermission = async () => {
  const permission = getLocationPermission();

  if (!permission) {
    throw createTrackingError(
      LOCATION_PERMISSION_MESSAGE,
      'LOCATION_PERMISSION_UNAVAILABLE',
    );
  }

  let permissionStatus = await check(permission);

  if (permissionStatus !== RESULTS.GRANTED) {
    permissionStatus = await request(permission, {
      title: 'Location permission',
      message: LOCATION_PERMISSION_MESSAGE,
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    });
  }

  if (permissionStatus !== RESULTS.GRANTED) {
    throw createTrackingError(
      LOCATION_PERMISSION_MESSAGE,
      'LOCATION_PERMISSION_DENIED',
      {
        shouldOpenSettings: permissionStatus === RESULTS.BLOCKED,
      },
    );
  }

  return permissionStatus;
};

export const sendLocationUpdate = async (orderId, location) => {
  if (!orderId || !hasValidCoordinates(location)) {
    return null;
  }

  return updateOrderDeliveryLocation(orderId, {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
  });
};

const emitTrackingError = error => {
  errorCallbacks.forEach(callback => {
    callback(error);
  });
};

const getTrackingStatusForStop = ({
  reason = 'manual',
  orderStatus = '',
} = {}) => {
  const normalizedOrderStatus = normalizeStatus(orderStatus);

  if (
    reason === 'completed' ||
    normalizedOrderStatus === 'delivered' ||
    normalizedOrderStatus === 'completed'
  ) {
    return 'completed';
  }

  return 'paused';
};

const sendTrackingStatusUpdate = async ({
  orderId,
  reason,
  orderStatus,
} = {}) => {
  if (!orderId) {
    return null;
  }

  return updateOrderTrackingStatus(
    orderId,
    getTrackingStatusForStop({ reason, orderStatus }),
  );
};

const flushLatestLocation = async (force = false) => {
  if (
    !trackingState.active ||
    !trackingState.orderId ||
    !hasValidCoordinates(latestLocation)
  ) {
    return null;
  }

  if (sendInFlight) {
    return null;
  }

  sendInFlight = true;

  try {
    await sendLocationUpdate(trackingState.orderId, latestLocation);
    return setTrackingState({
      latestLocation,
      warning: '',
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    setTrackingState({ warning: LOCATION_RETRY_WARNING });
    emitTrackingError(
      createTrackingError(LOCATION_RETRY_WARNING, 'LOCATION_UPDATE_FAILED', {
        cause: error,
      }),
    );
    return null;
  } finally {
    sendInFlight = false;
  }
};

const applyPositionUpdate = position => {
  if (!trackingState.active) {
    return;
  }

  const nextLocation = normalizeLocation(position);

  if (!hasValidCoordinates(nextLocation)) {
    return;
  }

  latestLocation = nextLocation;
  setTrackingState({ latestLocation: nextLocation });

  if (!trackingState.lastUpdatedAt) {
    void flushLatestLocation(true);
  }
};

const startWatcher = () => {
  watchId = Geolocation.watchPosition(
    position => {
      applyPositionUpdate(position);
    },
    () => {
      setTrackingState({ warning: LOCATION_RETRY_WARNING });
      emitTrackingError(
        createTrackingError(LOCATION_RETRY_WARNING, 'LOCATION_WATCH_FAILED'),
      );
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 0,
      interval: 10000,
      fastestInterval: 5000,
      showLocationDialog: true,
      forceRequestLocation: true,
    },
  );
};

export const startLiveTracking = async (orderId, onUpdate, onError) => {
  if (!orderId) {
    throw createTrackingError('Order not found.', 'ORDER_ID_MISSING');
  }

  if (typeof onUpdate === 'function') {
    updateCallbacks.add(onUpdate);
  }

  if (typeof onError === 'function') {
    errorCallbacks.add(onError);
  }

  if (trackingState.active && trackingState.orderId === orderId) {
    return emitTrackingState();
  }

  if (trackingState.active && trackingState.orderId !== orderId) {
    await stopLiveTracking({ reason: 'manual' });
  }

  await requestLocationPermission();
  clearTrackingResources();

  latestLocation = null;
  sendInFlight = false;
  setTrackingState({
    active: true,
    orderId,
    lastTrackedOrderId: orderId,
    warning: '',
    lastUpdatedAt: null,
    latestLocation: null,
  });

  startWatcher();
  intervalId = setInterval(() => {
    void flushLatestLocation();
  }, TRACKING_INTERVAL_MS);

  try {
    const position = await getCurrentPosition();
    applyPositionUpdate(position);
  } catch (error) {
    if (trackingState.active && trackingState.orderId === orderId) {
      setTrackingState({ warning: LOCATION_RETRY_WARNING });
      emitTrackingError(
        createTrackingError(LOCATION_RETRY_WARNING, 'LOCATION_FETCH_FAILED', {
          cause: error,
        }),
      );
    }
  }

  return emitTrackingState();
};

export const stopLiveTracking = async (options = {}) => {
  const lastTrackedOrderId =
    trackingState.orderId || trackingState.lastTrackedOrderId;
  const activeOrderId = trackingState.orderId;

  clearTrackingResources();
  latestLocation = null;
  sendInFlight = false;

  const nextState = setTrackingState({
    active: false,
    orderId: '',
    lastTrackedOrderId,
    warning: '',
    latestLocation: null,
  });

  if (activeOrderId) {
    try {
      await sendTrackingStatusUpdate({
        orderId: activeOrderId,
        reason: options.reason,
        orderStatus: options.orderStatus,
      });
    } catch (error) {
      emitTrackingError(
        createTrackingError(
          'Unable to update tracking status. Retrying location updates is stopped.',
          'TRACKING_STATUS_UPDATE_FAILED',
          { cause: error },
        ),
      );
    }
  }

  return nextState;
};

export const isLiveTrackingActive = () =>
  Boolean(trackingState.active && trackingState.orderId);

export const getActiveTrackingOrderId = () => trackingState.orderId || '';

export const isTrackingActive = () => isLiveTrackingActive();

export const getLiveTrackingState = () => ({ ...trackingState });

export const subscribeToLiveTracking = listener => {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  listener({ ...trackingState });

  return () => {
    listeners.delete(listener);
  };
};

export const promptToOpenLocationSettings = async () => {
  try {
    await openSettings('application');
  } catch (error) {
    return false;
  }

  return true;
};

export const syncTrackedOrderStatus = orderLike => {
  const orderId = getOrderIdentifier(
    orderLike?.order || orderLike?.data || orderLike,
  );
  const status =
    orderLike?.orderStatus ||
    orderLike?.status ||
    orderLike?.order?.orderStatus ||
    orderLike?.order?.status ||
    orderLike?.data?.orderStatus ||
    orderLike?.data?.status ||
    '';

  if (
    !trackingState.active ||
    !trackingState.orderId ||
    orderId !== trackingState.orderId ||
    !status
  ) {
    return false;
  }

  if (isTerminalStatus(status) || !isTrackableStatus(status)) {
    void stopLiveTracking({
      reason:
        normalizeStatus(status) === 'delivered' ||
        normalizeStatus(status) === 'completed'
          ? 'completed'
          : 'manual',
      orderStatus: status,
    });
    return true;
  }

  return false;
};

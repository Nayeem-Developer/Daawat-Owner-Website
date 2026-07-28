import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, {
  AndroidCategory,
  AndroidColor,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
} from "@notifee/react-native";
import messaging from "@react-native-firebase/messaging";
import axios from "axios";
import { Platform } from "react-native";
import { API_BASE_URL } from "../config/apiConfig";
import { navigateToOrderDetails, navigateToOrders } from "../navigation/navigationService";
import { getOrderIdentifier } from "../utils/formatters";
import {
  hasProcessedOwnerEvent,
  isOwnerCancellationEvent,
  isOwnerNewOrderEvent,
  markOwnerEventProcessed,
  normalizeOwnerOrderEvent,
  OWNER_EVENT_NEW_ORDER_NOTIFICATION,
  OWNER_EVENT_ORDER_CANCELLED,
} from "../utils/ownerOrderEvents";
import { stopOrderAlertSound } from "./orderAlertSound";

const OWNER_SESSION_TOKEN_KEY = "ownerToken";
const OWNER_FCM_TOKEN_KEY = "ownerFcmToken";
const ACTIVE_ORDER_STORAGE_KEY = "ownerNotificationActiveOrder";
const PENDING_ORDERS_NAVIGATION_KEY = "ownerNotificationPendingOrdersNavigation";
const PENDING_ORDER_DETAILS_NAVIGATION_KEY = "ownerNotificationPendingOrderDetailsNavigation";
const OWNER_ORDERS_CHANNEL_ID = "owner_order_alerts";
const ACTIVE_ORDER_NOTIFICATION_ID = "owner-order-active";
const CANCELLATION_NOTIFICATION_ID_PREFIX = "owner-order-cancelled";
const ACTION_OPEN_ORDERS = "OPEN_ORDERS";
const ACTION_ACCEPT_ORDER = "ACCEPT_ORDER";
const ACTION_REJECT_ORDER = "REJECT_ORDER";
const DEFAULT_PRESS_ACTION_ID = "default";
const OWNER_NOTIFICATION_COLOR = "#8B1E2D";
const OWNER_NOTIFICATION_LARGE_ICON = require("../assets/images/daawat_owner_notification_large.png");

const OWNER_DEVICE_TOKEN_ENDPOINT = `${API_BASE_URL}/api/owner/device-token`;
const ownerOrderStatusUrl = (orderId) => `${API_BASE_URL}/api/owner/orders/${orderId}/status`;

const logDev = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

const sanitizeString = (value) => (value === undefined || value === null ? "" : String(value).trim());

const hasGrantedPermission = (status) =>
  status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "0";
  }

  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const normalizeNotificationOrderEvent = value => normalizeOwnerOrderEvent(value);

const normalizeNotificationOrder = value => {
  const event = normalizeNotificationOrderEvent(value);

  if (!event?.order || !isOwnerNewOrderEvent(event)) {
    return null;
  }

  return {
    ...event.order,
    totalAmount: formatAmount(event.order?.total || 0),
    type: OWNER_EVENT_NEW_ORDER_NOTIFICATION,
  };
};

const getCancellationNotificationId = event => {
  const orderId = sanitizeString(getOrderIdentifier(event?.order));
  return `${CANCELLATION_NOTIFICATION_ID_PREFIX}-${sanitizeString(event?.eventId) || orderId || "unknown"}`;
};

const readOwnerSessionToken = async () => sanitizeString(await AsyncStorage.getItem(OWNER_SESSION_TOKEN_KEY));

const readStoredFcmToken = async () => sanitizeString(await AsyncStorage.getItem(OWNER_FCM_TOKEN_KEY));

const hasOwnerSession = async () => Boolean(await readOwnerSessionToken());

const ensureOrdersNavigationQueued = async () => {
  if (navigateToOrders()) {
    await AsyncStorage.removeItem(PENDING_ORDERS_NAVIGATION_KEY);
    return true;
  }

  await AsyncStorage.setItem(PENDING_ORDERS_NAVIGATION_KEY, "true");
  return false;
};

const ensureOrderDetailsNavigationQueued = async (order) => {
  if (navigateToOrderDetails(order)) {
    await AsyncStorage.removeItem(PENDING_ORDER_DETAILS_NAVIGATION_KEY);
    return true;
  }

  await AsyncStorage.setItem(
    PENDING_ORDER_DETAILS_NAVIGATION_KEY,
    JSON.stringify(order || null),
  );
  return false;
};

const storeActiveNotificationOrder = async (order) => {
  await AsyncStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const readActiveNotificationOrder = async () => {
  const rawValue = await AsyncStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

const updateOwnerOrderStatusFromNotification = async (orderId, orderStatus) => {
  const ownerToken = await readOwnerSessionToken();
  if (!ownerToken) {
    throw new Error("Owner session expired");
  }

  return axios.patch(
    ownerOrderStatusUrl(orderId),
    { orderStatus },
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );
};

const handleNotificationAction = async (pressActionId, notification) => {
  const event = normalizeNotificationOrderEvent(notification);
  const order = event?.order;
  if (!order?._id) {
    return { handled: false };
  }

  if (pressActionId === ACTION_ACCEPT_ORDER) {
    await updateOwnerOrderStatusFromNotification(order._id, "Accepted");
    await stopOrderAlert(order._id);
    return { handled: true, action: "Accepted", orderId: order._id };
  }

  if (pressActionId === ACTION_REJECT_ORDER) {
    await updateOwnerOrderStatusFromNotification(order._id, "Rejected");
    await stopOrderAlert(order._id);
    return { handled: true, action: "Rejected", orderId: order._id };
  }

  if (pressActionId === ACTION_OPEN_ORDERS || pressActionId === DEFAULT_PRESS_ACTION_ID) {
    if (isOwnerCancellationEvent(event)) {
      await ensureOrderDetailsNavigationQueued(order);
      return { handled: true, action: "OpenedCancelledOrder", orderId: order._id };
    }

    await ensureOrdersNavigationQueued();
    return { handled: true, action: "Opened", orderId: order._id };
  }

  return { handled: false };
};

const processNotifeeEvent = async (event) => {
  const pressActionId = sanitizeString(event?.detail?.pressAction?.id);

  if (event?.type === EventType.ACTION_PRESS && pressActionId) {
    return handleNotificationAction(pressActionId, event.detail?.notification);
  }

  if (event?.type === EventType.PRESS) {
    return handleNotificationAction(ACTION_OPEN_ORDERS, event.detail?.notification);
  }

  return { handled: false };
};

export const ensureOwnerOrderChannel = async () =>
  notifee.createChannel({
    id: OWNER_ORDERS_CHANNEL_ID,
    name: "Owner Order Alerts",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    vibrationPattern: [300, 900, 300, 900],
    lights: true,
    lightColor: AndroidColor.RED,
    badge: true,
  });

export const createOrderNotificationChannel = ensureOwnerOrderChannel;

export const requestNotificationPermission = async () => {
  await ensureOwnerOrderChannel();

  try {
    const settings =
      Platform.OS === "android" && Platform.Version < 33
        ? await notifee.getNotificationSettings()
        : await notifee.requestPermission({
            sound: true,
            alert: true,
            badge: true,
          });

    const authorizationStatus = settings?.authorizationStatus ?? AuthorizationStatus.DENIED;

    return {
      granted:
        Platform.OS === "android" && Platform.Version < 33
          ? authorizationStatus !== AuthorizationStatus.DENIED
          : hasGrantedPermission(authorizationStatus),
      authorizationStatus,
    };
  } catch (error) {
    logDev("[notifications] permission request failed", error?.message || error);
    return {
      granted: false,
      authorizationStatus: AuthorizationStatus.DENIED,
    };
  }
};

export const getOwnerFcmToken = async () => {
  try {
    await messaging().registerDeviceForRemoteMessages().catch(() => {});
    const token = sanitizeString(await messaging().getToken());

    if (token) {
      await AsyncStorage.setItem(OWNER_FCM_TOKEN_KEY, token);
    }

    return token;
  } catch (error) {
    logDev("[notifications] failed to get FCM token", error?.message || error);
    return "";
  }
};

export const registerOwnerFcmToken = async (ownerTokenOrOverride = "", overrideToken = "") => {
  const ownerTokenCandidate = sanitizeString(ownerTokenOrOverride);
  const ownerToken = ownerTokenCandidate || (await readOwnerSessionToken());
  if (!ownerToken) {
    return "";
  }

  const fcmToken = sanitizeString(overrideToken) || (await getOwnerFcmToken());
  if (!fcmToken) {
    return "";
  }

  await axios.post(
    OWNER_DEVICE_TOKEN_ENDPOINT,
    {
      token: fcmToken,
      platform: Platform.OS || "android",
    },
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  await AsyncStorage.setItem(OWNER_FCM_TOKEN_KEY, fcmToken);
  return fcmToken;
};

export const removeOwnerFcmToken = async ({ ownerToken = "", fcmToken = "" } = {}) => {
  const sessionToken = sanitizeString(ownerToken) || (await readOwnerSessionToken());
  const tokenToRemove =
    sanitizeString(fcmToken) || (await readStoredFcmToken()) || (await getOwnerFcmToken());

  try {
    if (sessionToken && tokenToRemove) {
      await axios.delete(OWNER_DEVICE_TOKEN_ENDPOINT, {
        data: {
          token: tokenToRemove,
        },
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      });
    }
  } catch (error) {
    logDev("[notifications] failed to remove FCM token", error?.message || error);
  } finally {
    await AsyncStorage.removeItem(OWNER_FCM_TOKEN_KEY);
  }
};

export const displayNewOrderNotification = async (orderInput) => {
  const order = normalizeNotificationOrder(orderInput);
  if (!order?._id) {
    return null;
  }

  if (!(await hasOwnerSession())) {
    return null;
  }

  await ensureOwnerOrderChannel();
  await storeActiveNotificationOrder(order);

  try {
    await notifee.displayNotification({
      id: ACTIVE_ORDER_NOTIFICATION_ID,
      title: "New Order Received",
      body: `Order from ${order.customerName} \u2022 \u20b9${order.totalAmount}`,
      data: {
        type: OWNER_EVENT_NEW_ORDER_NOTIFICATION,
        eventId: "",
        orderId: order._id,
        mongoOrderId: order._id,
        displayOrderId: order.orderId,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt,
      },
      android: {
        channelId: OWNER_ORDERS_CHANNEL_ID,
        smallIcon: "ic_stat_daawat_owner",
        largeIcon: OWNER_NOTIFICATION_LARGE_ICON,
        color: OWNER_NOTIFICATION_COLOR,
        pressAction: {
          id: DEFAULT_PRESS_ACTION_ID,
          launchActivity: "default",
        },
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        ongoing: true,
        autoCancel: false,
        sound: "default",
        vibrationPattern: [300, 900, 300, 900],
        visibility: AndroidVisibility.PUBLIC,
        showTimestamp: true,
        actions: [
          {
            title: "Accept",
            pressAction: {
              id: ACTION_ACCEPT_ORDER,
            },
          },
          {
            title: "Reject",
            pressAction: {
              id: ACTION_REJECT_ORDER,
            },
          },
        ],
      },
    });
  } catch (error) {
    logDev("[notifications] display failed", error?.message || error);
  }

  return order;
};

export const displayCancellationNotification = async (eventInput) => {
  const event = normalizeNotificationOrderEvent(eventInput);
  if (!event?.order || !isOwnerCancellationEvent(event)) {
    return null;
  }

  if (!(await hasOwnerSession())) {
    return null;
  }

  await ensureOwnerOrderChannel();

  try {
    await notifee.displayNotification({
      id: getCancellationNotificationId(event),
      title: "Order Cancelled",
      body: `Order #${event.order?.orderId || event.order?._id} was cancelled by the customer.`,
      data: {
        type: OWNER_EVENT_ORDER_CANCELLED,
        eventId: event.eventId,
        orderId: event.orderId,
        mongoOrderId: event.orderId,
        displayOrderId: event.order?.orderId,
        customerName: event.order?.customerName,
        phone: event.order?.phone,
        address: event.order?.addressText || event.order?.address,
        status: event.status,
        updatedAt: event.updatedAt,
      },
      android: {
        channelId: OWNER_ORDERS_CHANNEL_ID,
        smallIcon: "ic_stat_daawat_owner",
        largeIcon: OWNER_NOTIFICATION_LARGE_ICON,
        color: OWNER_NOTIFICATION_COLOR,
        pressAction: {
          id: DEFAULT_PRESS_ACTION_ID,
          launchActivity: "default",
        },
        category: AndroidCategory.STATUS,
        importance: AndroidImportance.HIGH,
        autoCancel: true,
        sound: "default",
        vibrationPattern: [300, 900, 300, 900],
        visibility: AndroidVisibility.PUBLIC,
        showTimestamp: true,
      },
    });
  } catch (error) {
    logDev("[notifications] cancellation display failed", error?.message || error);
  }

  return event;
};

export const stopOrderAlert = async (orderId = "") => {
  stopOrderAlertSound();

  const activeOrder = await readActiveNotificationOrder();
  const nextOrderId = sanitizeString(orderId);

  if (nextOrderId && activeOrder?._id && activeOrder._id !== nextOrderId) {
    return false;
  }

  await AsyncStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);

  try {
    await notifee.cancelNotification(ACTIVE_ORDER_NOTIFICATION_ID);
  } catch (error) {
    logDev("[notifications] cancel failed", error?.message || error);
  }

  return true;
};

export const setupForegroundNotifications = ({
  onForegroundOrderEvent,
  onOrderSyncRequested,
} = {}) => {
  const handleSyncRequest = async () => {
    if (typeof onOrderSyncRequested === "function") {
      await onOrderSyncRequested();
    }
  };

  const handleForegroundOrderEventRequest = async (eventPayload) => {
    if (typeof onForegroundOrderEvent === "function") {
      await onForegroundOrderEvent(eventPayload);
    }
  };

  const processInitialNotifications = async () => {
    try {
      const initialNotification = await notifee.getInitialNotification();
      const event = normalizeNotificationOrderEvent(initialNotification?.notification);
      if (event?.order) {
        if (isOwnerCancellationEvent(event)) {
          await ensureOrderDetailsNavigationQueued(event.order);
        } else {
          await ensureOrdersNavigationQueued();
        }
        await handleSyncRequest();
      }
    } catch (error) {
      logDev("[notifications] failed to process initial notifee notification", error?.message || error);
    }

    try {
      const initialRemoteMessage = await messaging().getInitialNotification();
      const event = normalizeNotificationOrderEvent(initialRemoteMessage);
      if (event?.order) {
        if (isOwnerCancellationEvent(event)) {
          await ensureOrderDetailsNavigationQueued(event.order);
        } else {
          await ensureOrdersNavigationQueued();
        }
        await handleSyncRequest();
      }
    } catch (error) {
      logDev("[notifications] failed to process initial remote message", error?.message || error);
    }
  };

  void processInitialNotifications();

  const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
    const event = normalizeNotificationOrderEvent(remoteMessage);
    if (!event?.order || !(await hasOwnerSession())) {
      return;
    }

    if (isOwnerCancellationEvent(event)) {
      await handleForegroundOrderEventRequest(remoteMessage);
      return;
    }

    const order = normalizeNotificationOrder(remoteMessage);
    if (!order) {
      return;
    }

    await displayNewOrderNotification(order);
    await handleForegroundOrderEventRequest(remoteMessage);
    await handleSyncRequest();
  });

  const unsubscribeForegroundEvents = notifee.onForegroundEvent(async (event) => {
    const result = await processNotifeeEvent(event);
    if (result?.handled) {
      await handleSyncRequest();
    }
  });

  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(async (remoteMessage) => {
    const event = normalizeNotificationOrderEvent(remoteMessage);
    if (!event?.order) {
      return;
    }

    if (isOwnerCancellationEvent(event)) {
      await ensureOrderDetailsNavigationQueued(event.order);
    } else {
      await ensureOrdersNavigationQueued();
    }
    await handleSyncRequest();
  });

  return () => {
    unsubscribeMessage();
    unsubscribeForegroundEvents();
    unsubscribeNotificationOpened();
  };
};

export const setupForegroundMessageHandler = setupForegroundNotifications;

export const setupBackgroundMessageHandler = async (remoteMessage) => {
  const event = normalizeNotificationOrderEvent(remoteMessage);
  if (!event?.order || !(await hasOwnerSession())) {
    return;
  }

  if (isOwnerCancellationEvent(event)) {
    if (await hasProcessedOwnerEvent(event)) {
      return;
    }

    await markOwnerEventProcessed(event);
    await displayCancellationNotification(event);
    return;
  }

  const order = normalizeNotificationOrder(remoteMessage);
  if (!order) {
    return;
  }

  await displayNewOrderNotification(order);
};

export const handleBackgroundNotificationEvent = async (event) => {
  try {
    await processNotifeeEvent(event);
  } catch (error) {
    logDev("[notifications] background event failed", error?.message || error);
  }
};

export const consumePendingOrdersNavigation = async () => {
  const shouldNavigate = sanitizeString(await AsyncStorage.getItem(PENDING_ORDERS_NAVIGATION_KEY));
  if (!shouldNavigate) {
    return false;
  }

  return ensureOrdersNavigationQueued();
};

export const consumePendingOrderDetailsNavigation = async () => {
  const rawValue = await AsyncStorage.getItem(PENDING_ORDER_DETAILS_NAVIGATION_KEY);
  if (!rawValue) {
    return false;
  }

  try {
    const order = JSON.parse(rawValue);
    return ensureOrderDetailsNavigationQueued(order);
  } catch {
    await AsyncStorage.removeItem(PENDING_ORDER_DETAILS_NAVIGATION_KEY);
    return false;
  }
};

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
import { navigateToOrders } from "../navigation/navigationService";
import { stopOrderAlertSound } from "./orderAlertSound";

const OWNER_SESSION_TOKEN_KEY = "ownerToken";
const OWNER_FCM_TOKEN_KEY = "ownerFcmToken";
const ACTIVE_ORDER_STORAGE_KEY = "ownerNotificationActiveOrder";
const PENDING_ORDERS_NAVIGATION_KEY = "ownerNotificationPendingOrdersNavigation";
const OWNER_ORDERS_CHANNEL_ID = "owner_orders";
const ACTIVE_ORDER_NOTIFICATION_ID = "owner-order-active";
const ACTION_OPEN_ORDERS = "OPEN_ORDERS";
const ACTION_ACCEPT_ORDER = "ACCEPT_ORDER";
const ACTION_REJECT_ORDER = "REJECT_ORDER";
const DEFAULT_PRESS_ACTION_ID = "default";
const NEW_ORDER_TYPE = "NEW_ORDER";
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

const normalizeNotificationOrder = (value) => {
  if (!value) {
    return null;
  }

  const sourceData = value?.data && typeof value.data === "object" ? value.data : value;
  const messageType = sanitizeString(sourceData.type);
  if (messageType && messageType !== NEW_ORDER_TYPE) {
    return null;
  }

  const mongoOrderId = sanitizeString(
    sourceData.mongoOrderId || sourceData.orderId || value?._id || value?.id
  );

  if (!mongoOrderId) {
    return null;
  }

  return {
    _id: mongoOrderId,
    orderId: sanitizeString(sourceData.displayOrderId || value?.orderId || mongoOrderId),
    customerName: sanitizeString(sourceData.customerName || value?.customerName) || "Customer",
    phone: sanitizeString(sourceData.phone || value?.phone),
    address: sanitizeString(sourceData.address || value?.address || value?.addressText),
    totalAmount: formatAmount(
      sourceData.totalAmount || value?.totalAmount || value?.total || value?.amount || 0
    ),
    paymentMethod: sanitizeString(sourceData.paymentMethod || value?.paymentMethod),
    status:
      sanitizeString(sourceData.status || value?.status || value?.orderStatus) ||
      "Pending Confirmation",
    createdAt: sanitizeString(sourceData.createdAt || value?.createdAt),
    type: NEW_ORDER_TYPE,
  };
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
  const order = normalizeNotificationOrder(notification);
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
    name: "New Order Alerts",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    vibrationPattern: [300, 900, 300, 900],
    lights: true,
    lightColor: AndroidColor.RED,
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
        type: NEW_ORDER_TYPE,
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

export const setupForegroundNotifications = ({ onOrderSyncRequested } = {}) => {
  const handleSyncRequest = async () => {
    if (typeof onOrderSyncRequested === "function") {
      await onOrderSyncRequested();
    }
  };

  const processInitialNotifications = async () => {
    try {
      const initialNotification = await notifee.getInitialNotification();
      if (initialNotification?.notification) {
        await ensureOrdersNavigationQueued();
        await handleSyncRequest();
      }
    } catch (error) {
      logDev("[notifications] failed to process initial notifee notification", error?.message || error);
    }

    try {
      const initialRemoteMessage = await messaging().getInitialNotification();
      const order = normalizeNotificationOrder(initialRemoteMessage);
      if (order) {
        await ensureOrdersNavigationQueued();
        await handleSyncRequest();
      }
    } catch (error) {
      logDev("[notifications] failed to process initial remote message", error?.message || error);
    }
  };

  void processInitialNotifications();

  const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
    const order = normalizeNotificationOrder(remoteMessage);
    if (!order || !(await hasOwnerSession())) {
      return;
    }

    await displayNewOrderNotification(order);
    await handleSyncRequest();
  });

  const unsubscribeForegroundEvents = notifee.onForegroundEvent(async (event) => {
    const result = await processNotifeeEvent(event);
    if (result?.handled) {
      await handleSyncRequest();
    }
  });

  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(async (remoteMessage) => {
    const order = normalizeNotificationOrder(remoteMessage);
    if (!order) {
      return;
    }

    await ensureOrdersNavigationQueued();
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
  const order = normalizeNotificationOrder(remoteMessage);
  if (!order || !(await hasOwnerSession())) {
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

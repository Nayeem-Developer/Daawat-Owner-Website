import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import messaging from "@react-native-firebase/messaging";
import { useAuth } from "../context/AuthContext";
import { useOrderAlert } from "../context/OrderAlertContext";
import {
  consumePendingOrderDetailsNavigation,
  consumePendingOrdersNavigation,
  registerOwnerFcmToken,
  requestNotificationPermission,
  setupForegroundMessageHandler,
  stopOrderAlert,
} from "../services/notificationService";

export default function NotificationBootstrap() {
  const { isAuthenticated, token } = useAuth();
  const { handleForegroundOrderEvent, requestOrderAlertRefresh } = useOrderAlert();
  const hasShownPermissionWarning = useRef(false);
  const handleForegroundOrderEventRef = useRef(handleForegroundOrderEvent);
  const requestOrderAlertRefreshRef = useRef(requestOrderAlertRefresh);

  useEffect(() => {
    handleForegroundOrderEventRef.current = handleForegroundOrderEvent;
  }, [handleForegroundOrderEvent]);

  useEffect(() => {
    requestOrderAlertRefreshRef.current = requestOrderAlertRefresh;
  }, [requestOrderAlertRefresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasShownPermissionWarning.current = false;
      void stopOrderAlert();
      return undefined;
    }

    const syncOrders = async () => {
      await requestOrderAlertRefreshRef.current({ broadcast: true, sync: true });
    };

    const bootstrapNotifications = async () => {
      const permission = await requestNotificationPermission();

      if (!permission.granted && !hasShownPermissionWarning.current) {
        hasShownPermissionWarning.current = true;
        Alert.alert(
          "Notifications",
          "Please enable notifications to receive new order alerts."
        );
      }

      if (permission.granted) {
        try {
          await registerOwnerFcmToken(token);
        } catch (error) {
          if (__DEV__) {
            console.log("[notifications] owner token registration failed", error?.message || error);
          }
        }
      }

      await consumePendingOrderDetailsNavigation();
      await consumePendingOrdersNavigation();
    };

    void bootstrapNotifications();

    const unsubscribeForeground = setupForegroundMessageHandler({
      onForegroundOrderEvent: eventPayload =>
        handleForegroundOrderEventRef.current?.(eventPayload),
      onOrderSyncRequested: syncOrders,
    });

    const unsubscribeTokenRefresh = messaging().onTokenRefresh((nextToken) => {
      void registerOwnerFcmToken(token, nextToken).catch((error) => {
        if (__DEV__) {
          console.log("[notifications] token refresh registration failed", error?.message || error);
        }
      });
    });

    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  }, [isAuthenticated, token]);

  return null;
}

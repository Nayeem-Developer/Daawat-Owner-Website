import "react-native-gesture-handler";
import { AppRegistry } from "react-native";
import notifee from "@notifee/react-native";
import messaging from "@react-native-firebase/messaging";
import App from "./App";
import { name as appName } from "./app.json";
import {
  handleBackgroundNotificationEvent,
  setupBackgroundMessageHandler,
} from "./src/services/notificationService";

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await setupBackgroundMessageHandler(remoteMessage);
});

notifee.onBackgroundEvent(async (event) => {
  await handleBackgroundNotificationEvent(event);
});

AppRegistry.registerComponent(appName, () => App);

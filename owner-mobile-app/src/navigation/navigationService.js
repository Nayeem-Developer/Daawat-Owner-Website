import { createNavigationContainerRef } from "@react-navigation/native";
import { getOrderIdentifier } from "../utils/formatters";

export const navigationRef = createNavigationContainerRef();

export const navigateToOrders = () => {
  if (!navigationRef.isReady()) {
    return false;
  }

  const rootState = navigationRef.getRootState();
  const routeNames = Array.isArray(rootState?.routeNames) ? rootState.routeNames : [];
  if (!routeNames.includes("Orders")) {
    return false;
  }

  navigationRef.navigate("Orders");
  return true;
};

export const navigateToOrderDetails = (orderInput) => {
  if (!navigationRef.isReady()) {
    return false;
  }

  const orderId = getOrderIdentifier(orderInput);
  if (!orderId) {
    return false;
  }

  const rootState = navigationRef.getRootState();
  const routeNames = Array.isArray(rootState?.routeNames) ? rootState.routeNames : [];
  if (!routeNames.includes("Order Details")) {
    return false;
  }

  navigationRef.navigate("Order Details", {
    order: orderInput,
    orderId,
  });
  return true;
};

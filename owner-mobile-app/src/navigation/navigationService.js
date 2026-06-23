import { createNavigationContainerRef } from "@react-navigation/native";

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

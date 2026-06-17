import { StyleSheet, Text } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { typography } from "../theme/theme";

const ICON_ALIASES = {
  "add-outline": "plus",
  "alert-circle-outline": "alert-circle-outline",
  "arrow-left": "arrow-left",
  "bicycle-outline": "truck-delivery-outline",
  "card-outline": "credit-card-outline",
  "cash-outline": "cash-check",
  "checkmark-circle-outline": "check-circle-outline",
  "checkmark-outline": "check-circle-outline",
  "chevron-forward": "chevron-right",
  "close-outline": "close-circle-outline",
  "cloud-outline": "cloud-outline",
  "create-outline": "pencil-outline",
  "cube-outline": "truck-delivery-outline",
  "ellipse-outline": "help-circle-outline",
  "eye-off-outline": "eye-off-outline",
  "eye-outline": "eye-outline",
  "flame-outline": "food-drumstick",
  "grid-outline": "view-dashboard-outline",
  "image-outline": "image-outline",
  "images-outline": "image-multiple-outline",
  "layers-outline": "shape-outline",
  "leaf-outline": "leaf",
  "location-outline": "map-marker-outline",
  "log-in-outline": "login",
  "log-out-outline": "logout",
  "mail-outline": "email-outline",
  "megaphone-outline": "bullhorn-outline",
  "phone-portrait-outline": "cellphone",
  "radio-outline": "store-check-outline",
  "receipt-outline": "receipt-text-outline",
  "restaurant-outline": "food-outline",
  "search-outline": "magnify",
  "settings-outline": "cog-outline",
  "time-outline": "clock-outline",
  "trash-outline": "trash-can-outline",
  "wallet-outline": "cash-multiple",
};

const SAFE_ICONS = new Set([
  "alert-circle-outline",
  "arrow-left",
  "bullhorn-outline",
  "cash-check",
  "cash-multiple",
  "cellphone",
  "check-circle-outline",
  "chevron-right",
  "clock-outline",
  "cloud-outline",
  "close-circle-outline",
  "cog-outline",
  "credit-card-outline",
  "email-outline",
  "eye-off-outline",
  "eye-outline",
  "food-drumstick",
  "food-outline",
  "help-circle-outline",
  "image-multiple-outline",
  "image-outline",
  "leaf",
  "login",
  "logout",
  "magnify",
  "map-marker-outline",
  "pencil-outline",
  "plus",
  "receipt-text-outline",
  "shape-outline",
  "store-check-outline",
  "trash-can-outline",
  "truck-delivery-outline",
  "view-dashboard-outline",
]);

const resolveIconName = (name) => ICON_ALIASES[name] || name;

export default function AppIcon({
  name,
  size = 20,
  color,
  style,
  fallback,
}) {
  const resolvedName = resolveIconName(name);
  const fallbackText = fallback || String(name || "").trim().slice(0, 1).toUpperCase() || "*";

  if (!resolvedName || !SAFE_ICONS.has(resolvedName)) {
    return (
      <Text style={[styles.fallback, { fontSize: size, color }, style]}>
        {fallbackText}
      </Text>
    );
  }

  return <MaterialCommunityIcons name={resolvedName} size={size} color={color} style={style} />;
}

const styles = StyleSheet.create({
  fallback: {
    fontSize: typography.body,
    fontWeight: "700",
    textAlign: "center",
  },
});

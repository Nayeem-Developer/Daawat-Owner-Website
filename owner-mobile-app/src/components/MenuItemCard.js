import { Image, StyleSheet, Text, View } from "react-native";
import AppButton from "./AppButton";
import { colors, radius, shadow } from "../theme/theme";
import { formatCurrency } from "../utils/formatters";

export default function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
  pending = false,
}) {
  return (
    <View style={styles.card}>
      {item?.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <Text style={styles.imageFallbackText}>{(item?.name || "M").slice(0, 1).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.name}>{item?.name}</Text>
        <Text style={styles.price}>{formatCurrency(item?.price || 0)}</Text>
        <Text style={styles.meta}>{item?.categoryName || "No category"}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, item?.isVeg ? styles.vegBadge : styles.nonVegBadge]}>
            <Text style={styles.badgeText}>{item?.isVeg ? "Veg" : "Non-Veg"}</Text>
          </View>
          <View
            style={[
              styles.badge,
              item?.isAvailable ? styles.availableBadge : styles.unavailableBadge,
            ]}
          >
            <Text style={styles.badgeText}>{item?.isAvailable ? "Available" : "Unavailable"}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <AppButton
            label="Edit"
            variant="ghost"
            onPress={onEdit}
            fullWidth={false}
            style={styles.actionButton}
          />
          <AppButton
            label={item?.isAvailable ? "Mark Unavailable" : "Mark Available"}
            variant={item?.isAvailable ? "danger" : "success"}
            onPress={onToggleAvailability}
            loading={pending}
            fullWidth={false}
            style={styles.actionButton}
          />
          <AppButton
            label="Delete"
            variant="ghost"
            onPress={onDelete}
            fullWidth={false}
            style={styles.actionButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(35,26,26,0.9)",
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.2)",
    ...shadow,
  },
  image: {
    width: "100%",
    height: 180,
  },
  imageFallback: {
    width: "100%",
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(160,39,46,0.45)",
  },
  imageFallbackText: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
  },
  content: {
    padding: 14,
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  price: {
    color: "#f9e8ca",
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  vegBadge: {
    borderColor: "rgba(46,173,105,0.58)",
    backgroundColor: "rgba(46,173,105,0.14)",
  },
  nonVegBadge: {
    borderColor: "rgba(196,94,66,0.6)",
    backgroundColor: "rgba(196,94,66,0.14)",
  },
  availableBadge: {
    borderColor: "rgba(34,150,95,0.6)",
    backgroundColor: "rgba(34,150,95,0.14)",
  },
  unavailableBadge: {
    borderColor: "rgba(201,66,66,0.65)",
    backgroundColor: "rgba(201,66,66,0.16)",
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    width: "100%",
  },
});

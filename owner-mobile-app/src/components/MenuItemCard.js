import { Image, StyleSheet, Text, View } from "react-native";
import AppIcon from "./AppIcon";
import AppButton from "./AppButton";
import { colors, getStatusPalette, radius, shadow, spacing, typography } from "../theme/theme";
import { formatCurrency } from "../utils/formatters";

export default function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
  pending = false,
}) {
  const availability = getStatusPalette(item?.isAvailable ? "Accepted" : "Rejected");

  return (
    <View style={styles.card}>
      {item?.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <Text style={styles.imageFallbackText}>
            {(item?.name || "M").slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.name}>{item?.name || "Unnamed Item"}</Text>
            <Text style={styles.meta}>{item?.categoryName || "No category"}</Text>
          </View>
          <Text style={styles.price}>{formatCurrency(item?.price || 0)}</Text>
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, item?.isVeg ? styles.vegBadge : styles.nonVegBadge]}>
            <AppIcon
              name={item?.isVeg ? "leaf" : "food-drumstick"}
              size={13}
              color={item?.isVeg ? colors.success : colors.warning}
            />
            <Text
              style={[
                styles.badgeText,
                { color: item?.isVeg ? colors.success : colors.warning },
              ]}
            >
              {item?.isVeg ? "Veg" : "Non-Veg"}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: availability.background,
                borderColor: availability.border,
              },
            ]}
          >
            <AppIcon name={availability.icon} size={13} color={availability.text} />
            <Text style={[styles.badgeText, { color: availability.text }]}>
              {item?.isAvailable ? "Available" : "Unavailable"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            label="Edit"
            variant="secondary"
            size="sm"
            leftIcon="pencil-outline"
            onPress={onEdit}
            fullWidth={false}
          />
          <AppButton
            label={item?.isAvailable ? "Hide" : "Show"}
            variant={item?.isAvailable ? "warning" : "success"}
            size="sm"
            leftIcon={item?.isAvailable ? "eye-off-outline" : "eye-outline"}
            onPress={onToggleAvailability}
            loading={pending}
            fullWidth={false}
          />
          <AppButton
            label="Delete"
            variant="ghost"
            size="sm"
            leftIcon="trash-can-outline"
            onPress={onDelete}
            fullWidth={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  image: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
  },
  imageFallback: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.goldSoft,
  },
  imageFallbackText: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  name: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  price: {
    color: colors.primary,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: typography.tiny,
    fontWeight: "700",
  },
  vegBadge: {
    borderColor: "#bfe5ce",
    backgroundColor: colors.successSoft,
  },
  nonVegBadge: {
    borderColor: "#f1c99e",
    backgroundColor: colors.warningSoft,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});

import { Image, StyleSheet, Text, View } from "react-native";
import AppIcon from "./AppIcon";
import AppButton from "./AppButton";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

export default function CategoryCard({ category, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      {category?.imageUrl ? (
        <Image source={{ uri: category.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <Text style={styles.imageFallbackText}>
            {(category?.name || "C").slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.name}>{category?.name || "Unnamed Category"}</Text>
            <Text style={styles.meta}>
              {Number.isFinite(Number(category?.itemCount))
                ? `${Number(category.itemCount)} items linked`
                : "Organize related menu items"}
            </Text>
          </View>
          <View style={styles.iconBadge}>
            <AppIcon name="shape-outline" size={18} color={colors.primary} />
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
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    ...shadow,
  },
  image: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
  },
  imageFallback: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  imageFallbackText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  name: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
});

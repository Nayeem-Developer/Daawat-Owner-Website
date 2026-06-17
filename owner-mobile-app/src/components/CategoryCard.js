import { Image, StyleSheet, Text, View } from "react-native";
import AppButton from "./AppButton";
import { colors, radius, shadow } from "../theme/theme";

export default function CategoryCard({ category, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      {category?.imageUrl ? (
        <Image source={{ uri: category.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <Text style={styles.imageFallbackText}>{(category?.name || "C").slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{category?.name || "Unnamed Category"}</Text>
        <Text style={styles.meta}>
          {Number.isFinite(Number(category?.itemCount))
            ? `${Number(category.itemCount)} items`
            : "Manage menu grouping"}
        </Text>
        <View style={styles.actions}>
          <AppButton label="Edit" variant="ghost" onPress={onEdit} fullWidth={false} />
          <AppButton label="Delete" variant="danger" onPress={onDelete} fullWidth={false} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "rgba(34,22,22,0.95)",
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.2)",
    alignItems: "center",
    ...shadow,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  imageFallback: {
    width: 88,
    height: 88,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(160,39,46,0.42)",
  },
  imageFallbackText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  meta: {
    color: "#e7d3b0",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
});

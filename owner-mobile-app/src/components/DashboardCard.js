import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "../theme/theme";

export default function DashboardCard({
  title,
  value,
  subtitle,
  onPress,
  tone = "default",
}) {
  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
        <View style={[styles.gradient, styles[tone] || styles.default]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={[styles.gradient, styles[tone] || styles.default]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "47%",
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow,
  },
  gradient: {
    minHeight: 136,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  default: {
    backgroundColor: "rgba(25,19,19,0.95)",
  },
  accent: {
    backgroundColor: "rgba(93,48,27,0.95)",
  },
  success: {
    backgroundColor: "rgba(22,67,48,0.95)",
  },
  gold: {
    backgroundColor: "rgba(87,60,18,0.96)",
  },
  title: {
    color: "#d9cbb8",
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#ecdcc2",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.88,
  },
});

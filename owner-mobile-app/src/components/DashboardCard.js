import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadow } from "../theme/theme";

const toneGradients = {
  default: ["rgba(25,19,19,0.95)", "rgba(35,24,24,0.95)"],
  accent: ["rgba(160,39,46,0.65)", "rgba(213,164,74,0.34)"],
  success: ["rgba(31,143,95,0.7)", "rgba(19,45,32,0.96)"],
  gold: ["rgba(117,79,18,0.82)", "rgba(37,24,14,0.98)"],
};

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
        <LinearGradient colors={toneGradients[tone] || toneGradients.default} style={styles.gradient}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <LinearGradient colors={toneGradients[tone] || toneGradients.default} style={styles.gradient}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </LinearGradient>
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

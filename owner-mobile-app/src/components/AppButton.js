import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "../theme/theme";

const gradientByVariant = {
  primary: [colors.primary, colors.gold],
  success: ["#1f8f5f", "#37b77b"],
  danger: ["#b73b3b", "#c94242"],
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  textStyle,
}) {
  const isGhost = variant === "ghost";
  const isChip = variant === "chip";
  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.text : colors.white} size="small" />
      ) : (
        <Text style={[styles.label, isGhost && styles.ghostLabel, textStyle]}>{label}</Text>
      )}
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        !fullWidth && styles.inlineButton,
        isGhost && styles.ghostButton,
        isChip && styles.chipButton,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {isGhost || isChip ? (
        content
      ) : (
        <LinearGradient colors={gradientByVariant[variant] || gradientByVariant.primary} style={styles.gradient}>
          {content}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  inlineButton: {
    alignSelf: "flex-start",
  },
  gradient: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  ghostButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  chipButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.36)",
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  ghostLabel: {
    color: colors.text,
  },
  disabled: {
    opacity: 0.6,
  },
});

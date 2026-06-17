import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme/theme";

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
      {isGhost || isChip ? content : <View style={[styles.gradient, styles[variant] || styles.primary]}>{content}</View>}
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
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.gold,
    borderWidth: 1,
  },
  success: {
    backgroundColor: "#1f8f5f",
  },
  danger: {
    backgroundColor: "#b73b3b",
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

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

const VARIANTS = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    text: colors.white,
    icon: colors.white,
  },
  secondary: {
    container: {
      backgroundColor: colors.primarySoft,
      borderColor: "#efcfd4",
    },
    text: colors.primary,
    icon: colors.primary,
  },
  ghost: {
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    text: colors.text,
    icon: colors.textSoft,
  },
  chip: {
    container: {
      backgroundColor: colors.chip,
      borderColor: colors.border,
    },
    text: colors.textSoft,
    icon: colors.textSoft,
  },
  success: {
    container: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    text: colors.white,
    icon: colors.white,
  },
  warning: {
    container: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    text: colors.white,
    icon: colors.white,
  },
  danger: {
    container: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    text: colors.white,
    icon: colors.white,
  },
};

const SIZES = {
  sm: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    icon: 16,
    fontSize: typography.small,
  },
  md: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    icon: 18,
    fontSize: typography.body,
  },
  lg: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    icon: 18,
    fontSize: typography.body,
  },
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const metrics = SIZES[size] || SIZES.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        palette.container,
        {
          minHeight: metrics.minHeight,
          paddingHorizontal: metrics.paddingHorizontal,
        },
        variant === "primary" && styles.primaryShadow,
        pressed && !disabled && !loading && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.icon} size="small" />
        ) : (
          <>
            {leftIcon ? (
              <Ionicons name={leftIcon} size={metrics.icon} color={palette.icon} />
            ) : null}
            <Text
              style={[
                styles.label,
                {
                  color: palette.text,
                  fontSize: metrics.fontSize,
                },
                textStyle,
              ]}
            >
              {label}
            </Text>
            {rightIcon ? (
              <Ionicons name={rightIcon} size={metrics.icon} color={palette.icon} />
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: {
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  disabled: {
    opacity: 0.56,
  },
  primaryShadow: {
    ...shadow,
  },
});

import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AppIcon from "./AppIcon";
import { colors, radius, spacing, typography } from "../theme/theme";

export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "none",
  rightIcon = null,
  onRightIconPress,
  rightText = "",
  onRightTextPress,
  helperText = "",
  style,
}) {
  const hasAction = Boolean(rightIcon || rightText);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputContainer, multiline && styles.multilineContainer]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={[
            styles.input,
            multiline && styles.multiline,
            hasAction && styles.inputWithAction,
            style,
          ]}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} style={styles.actionButton} hitSlop={8}>
            {typeof rightIcon === "string" ? (
              <AppIcon name={rightIcon} size={20} color={colors.primary} />
            ) : (
              rightIcon
            )}
          </Pressable>
        ) : null}
        {!rightIcon && rightText ? (
          <Pressable onPress={onRightTextPress} style={styles.actionButton} hitSlop={8}>
            <Text style={styles.actionText}>{rightText}</Text>
          </Pressable>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  multilineContainer: {
    alignItems: "flex-start",
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
  },
  inputWithAction: {
    paddingRight: spacing.sm,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  actionButton: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "700",
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.tiny,
  },
});

import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme/theme";

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
              <Text style={styles.actionText}>{rightIcon}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputWithAction: {
    paddingRight: 8,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  actionButton: {
    minHeight: 50,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "700",
  },
});

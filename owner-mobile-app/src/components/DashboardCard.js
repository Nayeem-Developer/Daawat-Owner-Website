import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "./AppIcon";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

const TONES = {
  neutral: {
    iconBg: "#f4ede5",
    icon: colors.textSoft,
    accent: colors.borderStrong,
  },
  primary: {
    iconBg: colors.primarySoft,
    icon: colors.primary,
    accent: colors.primary,
  },
  gold: {
    iconBg: colors.goldSoft,
    icon: colors.gold,
    accent: colors.gold,
  },
  success: {
    iconBg: colors.successSoft,
    icon: colors.success,
    accent: colors.success,
  },
  warning: {
    iconBg: colors.warningSoft,
    icon: colors.warning,
    accent: colors.warning,
  },
  danger: {
    iconBg: colors.dangerSoft,
    icon: colors.danger,
    accent: colors.danger,
  },
  info: {
    iconBg: colors.infoSoft,
    icon: colors.info,
    accent: colors.info,
  },
};

export default function DashboardCard({
  title,
  value,
  subtitle,
  onPress,
  tone = "neutral",
  icon = "view-dashboard-outline",
  kind = "metric",
  style,
}) {
  const palette = TONES[tone] || TONES.neutral;
  const isAction = kind === "action";
  const content = (
    <View
      style={[
        styles.card,
        isAction ? styles.actionCard : styles.metricCard,
        { borderLeftColor: palette.accent },
        style,
      ]}
    >
      <View style={isAction ? styles.actionRow : styles.metricTopRow}>
        <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
          <AppIcon name={icon} size={20} color={palette.icon} />
        </View>
        {isAction ? (
          <AppIcon name="chevron-right" size={18} color={colors.muted} />
        ) : null}
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.pressable}>{content}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minWidth: "47%",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  metricCard: {
    minHeight: 124,
  },
  actionCard: {
    minHeight: 96,
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    gap: spacing.xs,
  },
  title: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.92,
  },
});

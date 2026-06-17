export const colors = {
  background: "#f6f1eb",
  backgroundAlt: "#fcf8f3",
  surface: "#ffffff",
  surfaceAlt: "#fffaf5",
  panel: "#fffdfb",
  panelStrong: "#fff6ee",
  border: "#eadfd4",
  borderStrong: "#ddcec0",
  text: "#241916",
  textSoft: "#5f5048",
  muted: "#8d7c72",
  primary: "#8f2330",
  primaryPressed: "#771b26",
  primarySoft: "#f6e4e7",
  gold: "#c9963d",
  goldSoft: "#fbf2e2",
  success: "#2f8b58",
  successSoft: "#e8f6ee",
  warning: "#d78333",
  warningSoft: "#fff1e1",
  danger: "#c5534d",
  dangerSoft: "#fdeae7",
  info: "#3f7da4",
  infoSoft: "#e9f2f8",
  input: "#fffaf6",
  chip: "#f7efe7",
  white: "#ffffff",
  overlay: "rgba(36, 24, 21, 0.34)",
  divider: "#f1e7dc",
  shadow: "#402720",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 999,
};

export const typography = {
  hero: 30,
  title: 26,
  section: 20,
  cardTitle: 17,
  body: 15,
  small: 13,
  tiny: 11,
};

export const shadow = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

export const shadowStrong = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.12,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

export const layout = {
  screenPadding: spacing.lg,
  sectionGap: spacing.lg,
  cardGap: spacing.md,
  bottomInset: 40,
};

export const getStatusPalette = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (
    normalized === "placed" ||
    normalized === "pending" ||
    normalized.includes("pending")
  ) {
    return {
      background: colors.warningSoft,
      text: colors.warning,
      border: "#f1c99e",
      icon: "time-outline",
    };
  }

  if (
    normalized === "accepted" ||
    normalized === "confirmed" ||
    normalized.includes("accepted") ||
    normalized.includes("confirmed") ||
    normalized.includes("preparing")
  ) {
    return {
      background: colors.successSoft,
      text: colors.success,
      border: "#bfe5ce",
      icon: "checkmark-circle-outline",
    };
  }

  if (normalized.includes("delivery")) {
    return {
      background: colors.infoSoft,
      text: colors.info,
      border: "#c5ddec",
      icon: "bicycle-outline",
    };
  }

  if (normalized.includes("delivered")) {
    return {
      background: colors.successSoft,
      text: colors.success,
      border: "#bfe5ce",
      icon: "cube-outline",
    };
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("reject") ||
    normalized.includes("expired")
  ) {
    return {
      background: colors.dangerSoft,
      text: colors.danger,
      border: "#f3c2bc",
      icon: "close-circle-outline",
    };
  }

  return {
    background: colors.goldSoft,
    text: colors.gold,
    border: "#edd5a8",
    icon: "ellipse-outline",
  };
};

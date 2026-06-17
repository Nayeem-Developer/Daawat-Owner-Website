import { useMemo } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import AppIcon from "../components/AppIcon";
import AppButton from "../components/AppButton";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { API_BASE_URL } from "../config/apiConfig";
import {
  colors,
  layout,
  radius,
  shadow,
  spacing,
  typography,
} from "../theme/theme";

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <AppIcon name={icon} size={16} color={colors.primary} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

export default function SettingsScreen() {
  const { owner, logout } = useAuth();
  const { isConnected } = useSocket();

  const appVersion = useMemo(() => require("../../package.json").version || "1.0.0", []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(owner?.name || "Daawat Owner").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.title}>{owner?.name || "Daawat Owner"}</Text>
          <Text style={styles.subtitle}>Owner account and environment settings</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <InfoRow icon="email-outline" label="Email" value={owner?.email || "Not available"} />
        <InfoRow
          icon="store-check-outline"
          label="Socket"
          value={isConnected ? "Connected" : "Disconnected"}
        />
        <InfoRow icon="cellphone" label="App Version" value={appVersion} />
        {__DEV__ ? (
          <InfoRow icon="cloud-outline" label="Backend URL" value={API_BASE_URL} />
        ) : null}
      </View>

      <AppButton
        label="Logout"
        variant="danger"
        leftIcon="logout"
        onPress={() =>
          Alert.alert("Logout", "Do you want to logout from the owner app?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: () => void logout() },
          ])
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: layout.bottomInset + spacing.xxl,
    gap: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
    ...shadow,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: radius.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    textAlign: "center",
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  infoRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "600",
  },
});

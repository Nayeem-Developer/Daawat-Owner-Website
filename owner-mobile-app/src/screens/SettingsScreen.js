import { useMemo } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import AppButton from "../components/AppButton";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { API_BASE_URL } from "../config/apiConfig";
import { colors, radius, shadow, spacing } from "../theme/theme";

export default function SettingsScreen() {
  const { owner, signOut } = useAuth();
  const { isConnected } = useSocket();

  const appVersion = useMemo(
    () => Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || "1.0.0",
    []
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Owner profile, session controls, and environment details.</Text>

        <InfoRow label="Owner Name" value={owner?.name || "Daawat Owner"} />
        <InfoRow label="Email" value={owner?.email || "Not available"} />
        <InfoRow label="Socket" value={isConnected ? "Connected" : "Disconnected"} />
        <InfoRow label="App Version" value={appVersion} />

        {__DEV__ ? <InfoRow label="Backend URL" value={API_BASE_URL} /> : null}

        <AppButton
          label="Logout"
          variant="danger"
          onPress={() =>
            Alert.alert("Logout", "Do you want to logout from the owner app?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: () => void signOut() },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  panel: {
    backgroundColor: "rgba(20,16,16,0.96)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
    ...shadow,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  infoRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  infoLabel: {
    color: "#d9c8ae",
    fontSize: 12,
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});

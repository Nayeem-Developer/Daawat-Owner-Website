import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchAppStatus, updateAppStatus } from "../api/ownerApi";
import { useSocket } from "../context/SocketContext";
import { colors, radius, shadow, spacing } from "../theme/theme";
import { formatDateTime } from "../utils/formatters";

export default function AppStatusScreen() {
  const { lastAppStatusEvent } = useSocket();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchAppStatus();
      setStatus(nextStatus);
    } catch (error) {
      Alert.alert("App Status", error?.message || "Failed to load app status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadStatus();
    }, [loadStatus])
  );

  useFocusEffect(
    useCallback(() => {
      if (lastAppStatusEvent) {
        void loadStatus();
      }
      return undefined;
    }, [lastAppStatusEvent, loadStatus])
  );

  const handleToggle = async (nextValue) => {
    try {
      setUpdating(true);
      const nextStatus = await updateAppStatus(nextValue);
      setStatus(nextStatus);
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Unable to update app status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          void loadStatus();
        }} tintColor={colors.gold} />
      }
    >
      <View style={styles.panel}>
        <Text style={styles.title}>App Status</Text>
        <Text style={styles.subtitle}>
          Toggle whether customers can place orders from the customer app.
        </Text>
        <View style={styles.statusRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.statusLabel}>Current State</Text>
            <Text style={styles.statusValue}>{status?.isActive ? "Active" : "Inactive"}</Text>
            <Text style={styles.statusMessage}>{status?.message || "No message available"}</Text>
          </View>
          <Switch
            value={status?.isActive !== false}
            onValueChange={handleToggle}
            disabled={updating}
            thumbColor={colors.white}
            trackColor={{ false: "#9b3e3e", true: "#37b77b" }}
          />
        </View>
        <Text style={styles.timestamp}>Updated: {formatDateTime(status?.updatedAt)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
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
    gap: 12,
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
  statusRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  statusLabel: {
    color: "#d9c8ae",
    fontSize: 12,
    textTransform: "uppercase",
  },
  statusValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  statusMessage: {
    color: colors.muted,
    fontSize: 14,
  },
  timestamp: {
    color: "#ffe9c2",
    fontSize: 12,
    fontWeight: "700",
  },
});

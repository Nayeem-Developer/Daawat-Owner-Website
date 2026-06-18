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
import AppIcon from "../components/AppIcon";
import { fetchAppStatus, updateAppStatus } from "../api/ownerApi";
import { useSocket } from "../context/SocketContext";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import {
  colors,
  radius,
  shadow,
  spacing,
  typography,
} from "../theme/theme";

export default function AppStatusScreen() {
  const { lastAppStatusEvent } = useSocket();
  const { bottomPadding, horizontalPadding, maxContentWidth, topPadding } = useResponsiveScreen();
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
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isActive = status?.isActive !== false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPadding,
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomPadding,
          maxWidth: maxContentWidth,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadStatus();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.iconWrap}>
            <AppIcon name="store-check-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.title}>App Status</Text>
            <Text style={styles.subtitle}>
              Control whether customers can place new orders.
            </Text>
          </View>
          <Switch
            value={status?.isActive !== false}
            onValueChange={handleToggle}
            disabled={updating}
            thumbColor={colors.white}
            trackColor={{ false: "#d1c4b8", true: colors.success }}
          />
        </View>

        <View style={styles.statusInfoCard}>
          <Text style={styles.statusLabel}>Current State</Text>
          <Text style={[styles.statusValue, { color: isActive ? colors.success : colors.danger }]}>
            {isActive ? "Active" : "Inactive"}
          </Text>
          <Text style={styles.statusMessage}>
            {isActive ? "Accepting orders" : "Not accepting orders"}
          </Text>
          <Text style={styles.helperText}>Changes apply immediately for new customer orders.</Text>
        </View>
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
    width: "100%",
    alignSelf: "center",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
  },
  statusInfoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statusLabel: {
    color: colors.textSoft,
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusValue: {
    fontSize: typography.section,
    fontWeight: "800",
  },
  statusMessage: {
    color: colors.textSoft,
    fontSize: typography.body,
    fontWeight: "600",
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
  },
});

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AppIcon from "../components/AppIcon";
import DashboardCard from "../components/DashboardCard";
import { fetchAppStatus, fetchOrderStats, fetchOrders } from "../api/ownerApi";
import { useSocket } from "../context/SocketContext";
import {
  colors,
  getStatusPalette,
  layout,
  radius,
  shadow,
  spacing,
  typography,
} from "../theme/theme";
import { computeOrderStats, formatCurrency, formatDateTime } from "../utils/formatters";

const quickActions = [
  {
    title: "Orders",
    subtitle: "Manage orders",
    screen: "Orders",
    icon: "receipt-text-outline",
    tone: "primary",
  },
  {
    title: "Calendar",
    subtitle: "View orders by date",
    screen: "Calendar",
    icon: "calendar-month-outline",
    tone: "info",
  },
  {
    title: "Categories",
    subtitle: "Manage categories",
    screen: "Categories",
    icon: "shape-outline",
    tone: "warning",
  },
  {
    title: "Menu Items",
    subtitle: "Edit food items",
    screen: "Menu Items",
    icon: "food-outline",
    tone: "gold",
  },
  {
    title: "Banners",
    subtitle: "Manage home banners",
    screen: "Banners",
    icon: "image-multiple-outline",
    tone: "info",
  },
  {
    title: "App Status",
    subtitle: "Open or close ordering",
    screen: "App Status",
    icon: "store-check-outline",
    tone: "success",
  },
  {
    title: "Settings",
    subtitle: "Logout",
    screen: "Settings",
    icon: "cog-outline",
    tone: "neutral",
  },
];

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { lastOrderEvent, lastAppStatusEvent } = useSocket();
  const [stats, setStats] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [appStatus, setAppStatus] = useState({ isActive: true, message: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const [statsResult, ordersResult, appStatusResult] = await Promise.allSettled([
        fetchOrderStats(),
        fetchOrders({ limit: 10 }),
        fetchAppStatus(),
      ]);

      const statsResponse =
        statsResult.status === "fulfilled" && statsResult.value ? statsResult.value : {};
      const ordersResponse =
        ordersResult.status === "fulfilled" && ordersResult.value
          ? ordersResult.value
          : { orders: [] };
      const appStatusResponse =
        appStatusResult.status === "fulfilled" && appStatusResult.value
          ? appStatusResult.value
          : { isActive: true, message: "" };

      const orders = (ordersResponse?.orders || []).slice(0, 5);
      const derivedStats = computeOrderStats(ordersResponse?.orders || []);

      setStats({
        totalOrders: statsResponse?.totalOrders ?? derivedStats.totalOrders,
        pendingOrders: statsResponse?.pendingOrders ?? derivedStats.pendingOrders,
        acceptedOrders: statsResponse?.acceptedOrders ?? derivedStats.acceptedOrders,
        deliveredOrders: statsResponse?.deliveredOrders ?? derivedStats.deliveredOrders,
        cancelledOrders: statsResponse?.cancelledOrders ?? derivedStats.cancelledOrders,
        totalRevenue: statsResponse?.totalRevenue ?? derivedStats.totalRevenue,
      });
      setRecentOrders(orders);
      setAppStatus(appStatusResponse || { isActive: true, message: "" });

      const firstError =
        [statsResult, ordersResult, appStatusResult]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason)
          .find(Boolean) || null;

      if (firstError && firstError?.status !== 401) {
        setError(firstError?.message || "Unable to load dashboard data right now.");
      }
    } catch (loadError) {
      if (loadError?.status !== 401) {
        setError(loadError?.message || "Unable to load dashboard data right now.");
        setStats({});
        setRecentOrders([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadDashboard();
    }, [loadDashboard])
  );

  useFocusEffect(
    useCallback(() => {
      if (!lastOrderEvent && !lastAppStatusEvent) {
        return undefined;
      }
      void loadDashboard();
      return undefined;
    }, [lastAppStatusEvent, lastOrderEvent, loadDashboard])
  );

  const summaryCards = useMemo(
    () => [
        {
          title: "Total Orders",
          value: String(stats?.totalOrders ?? 0),
          icon: "receipt-text-outline",
          tone: "primary",
        },
        {
          title: "Pending",
          value: String(stats?.pendingOrders ?? 0),
          icon: "clock-outline",
          tone: "warning",
        },
        {
          title: "Accepted",
          value: String(stats?.acceptedOrders ?? 0),
          icon: "check-circle-outline",
          tone: "success",
        },
        {
          title: "Delivered",
          value: String(stats?.deliveredOrders ?? 0),
          icon: "truck-delivery-outline",
          tone: "info",
        },
      {
        title: "Cancelled",
        value: String(stats?.cancelledOrders ?? 0),
        icon: "close-circle-outline",
        tone: "danger",
      },
        {
          title: "Revenue",
          value: formatCurrency(stats?.totalRevenue ?? 0),
          icon: "cash-multiple",
          tone: "gold",
        },
    ],
    [stats]
  );

  const appStatusState = appStatus?.isActive ? "Active" : "Inactive";
  const appStatusDescription = appStatus?.isActive ? "Accepting orders" : "Not accepting orders";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadDashboard();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={styles.headerTitle}>Daawat Owner</Text>
          <Text style={styles.headerSubtitle}>Manage restaurant operations</Text>
        </View>
        <Pressable style={styles.settingsButton} onPress={() => navigation.navigate("Settings")}>
          <AppIcon name="cog-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.statusCard, pressed && styles.statusCardPressed]}
        onPress={() => navigation.navigate("App Status")}
      >
        <View style={styles.statusTopRow}>
          <View style={styles.statusTextWrap}>
            <Text style={styles.statusLabel}>App Status</Text>
            <Text style={styles.statusMessage}>{appStatusDescription}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              appStatus?.isActive ? styles.activePill : styles.inactivePill,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: appStatus?.isActive ? colors.success : colors.danger },
              ]}
            >
              {appStatusState}
            </Text>
          </View>
        </View>

        <View style={styles.statusFooterRow}>
          <Text style={styles.statusHint}>Tap to manage ordering availability</Text>
          <AppIcon name="chevron-right" size={18} color={colors.muted} />
        </View>
      </Pressable>

      {error ? (
        <View style={styles.errorCard}>
          <AppIcon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today at a glance</Text>
        <View style={styles.statsGrid}>
          {summaryCards.map((card) => (
            <DashboardCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <DashboardCard
              key={action.screen}
              title={action.title}
              subtitle={action.subtitle}
              icon={action.icon}
              tone={action.tone}
              kind="action"
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Pressable onPress={() => navigation.navigate("Orders")}>
            <Text style={styles.linkText}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.ordersList}>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent orders available yet.</Text>
            </View>
          ) : (
            recentOrders.map((order) => {
              const statusPalette = getStatusPalette(order?.status || order?.orderStatus);

              return (
                <View key={order?._id || order?.orderId} style={styles.orderCard}>
                  <View style={styles.orderTopRow}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={styles.orderIdText}>Order #{order?.orderId || order?._id}</Text>
                      <Text style={styles.orderCustomer}>{order?.customerName || "Customer"}</Text>
                    </View>
                    <View
                      style={[
                        styles.orderStatusBadge,
                        {
                          backgroundColor: statusPalette.background,
                          borderColor: statusPalette.border,
                        },
                      ]}
                    >
                      <Text style={[styles.orderStatusText, { color: statusPalette.text }]}>
                        {order?.status || order?.orderStatus || "Unknown"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderBottomRow}>
                    <Text style={styles.orderMeta}>{formatCurrency(order?.total ?? 0)}</Text>
                    <Text style={styles.orderMeta}>{formatDateTime(order?.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}
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
    padding: layout.screenPadding,
    paddingBottom: layout.bottomInset + spacing.xxl,
    gap: layout.sectionGap,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: typography.body,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  statusCardPressed: {
    opacity: 0.94,
  },
  statusTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  statusTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  statusLabel: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  statusMessage: {
    color: colors.textSoft,
    fontSize: typography.body,
    fontWeight: "600",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activePill: {
    backgroundColor: colors.successSoft,
    borderColor: "#bfe5ce",
  },
  inactivePill: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#f3c2bc",
  },
  statusPillText: {
    fontSize: typography.tiny,
    fontWeight: "700",
  },
  statusFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  statusHint: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#f2c3be",
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: "600",
  },
  section: {
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  actionsGrid: {
    gap: spacing.md,
  },
  ordersList: {
    gap: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  orderTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  orderIdText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  orderCustomer: {
    color: colors.textSoft,
    fontSize: typography.small,
  },
  orderStatusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orderStatusText: {
    fontSize: typography.tiny,
    fontWeight: "700",
  },
  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  orderMeta: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
  },
});

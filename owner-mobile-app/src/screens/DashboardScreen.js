import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AppIcon from "../components/AppIcon";
import DashboardCard from "../components/DashboardCard";
import RevenueCard from "../components/RevenueCard";
import { fetchAppStatus, fetchOrderStats, fetchOrders } from "../api/ownerApi";
import { useAuth } from "../context/AuthContext";
import { useOrderAlert } from "../context/OrderAlertContext";
import { useSocket } from "../context/SocketContext";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import {
  colors,
  getStatusPalette,
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
    title: "Promotions",
    subtitle: "Send offers to customers",
    screen: "Promotions",
    icon: "bell-ring-outline",
    tone: "info",
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

const getOrderDateValue = (order) =>
  order?.createdAt || order?.created_at || order?.date || order?.updatedAt || order?.updated_at;

const isSameLocalDate = (value, date) => {
  if (!value || !date) {
    return false;
  }

  const orderDate = new Date(value);
  const selected = new Date(date);

  if (Number.isNaN(orderDate.getTime()) || Number.isNaN(selected.getTime())) {
    return false;
  }

  return (
    orderDate.getFullYear() === selected.getFullYear() &&
    orderDate.getMonth() === selected.getMonth() &&
    orderDate.getDate() === selected.getDate()
  );
};

const formatSelectedDateLabel = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getDashboardStats = (orders = []) =>
  orders.reduce(
    (stats, order) => {
      const status = String(order?.status || order?.orderStatus || "").trim().toLowerCase();

      stats.totalOrders += 1;

      if (status === "placed" || status === "pending" || status.includes("pending")) {
        stats.pendingOrders += 1;
      }

      if (
        status === "accepted" ||
        status === "confirmed" ||
        status.includes("accepted") ||
        status.includes("confirmed")
      ) {
        stats.acceptedOrders += 1;
      }

      if (status === "delivered" || status.includes("delivered")) {
        stats.deliveredOrders += 1;
        stats.totalRevenue += Number(order?.total || 0);
      }

      if (status.includes("cancel") || status.includes("reject") || status.includes("expired")) {
        stats.cancelledOrders += 1;
      }

      return stats;
    },
    {
      totalOrders: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
    }
  );

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { owner, verifyOwnerPassword } = useAuth();
  const { lastOrderEvent, lastAppStatusEvent } = useSocket();
  const { refreshSignal } = useOrderAlert();
  const {
    bottomPadding,
    horizontalPadding,
    maxContentWidth,
    stackHeaderActions,
    summaryColumns,
    topPadding,
  } = useResponsiveScreen({ includeTopInset: true });
  const [overallStats, setOverallStats] = useState({});
  const [orders, setOrders] = useState([]);
  const [appStatus, setAppStatus] = useState({ isActive: true, message: "" });
  const [selectedDate, setSelectedDate] = useState(null);
  const [isRevenueVisible, setIsRevenueVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const [statsResult, ordersResult, appStatusResult] = await Promise.allSettled([
        fetchOrderStats(),
        fetchOrders({ limit: 100 }),
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

      const allOrders = ordersResponse?.orders || [];
      const derivedStats = computeOrderStats(allOrders);

      setOverallStats({
        totalOrders: statsResponse?.totalOrders ?? derivedStats.totalOrders,
        pendingOrders: statsResponse?.pendingOrders ?? derivedStats.pendingOrders,
        acceptedOrders: statsResponse?.acceptedOrders ?? derivedStats.acceptedOrders,
        deliveredOrders: statsResponse?.deliveredOrders ?? derivedStats.deliveredOrders,
        cancelledOrders: statsResponse?.cancelledOrders ?? derivedStats.cancelledOrders,
        totalRevenue: statsResponse?.totalRevenue ?? derivedStats.totalRevenue,
      });
      setOrders(allOrders);
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
        setOverallStats({});
        setOrders([]);
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

  useEffect(() => {
    if (!refreshSignal) {
      return;
    }

    setIsRevenueVisible(false);
    void loadDashboard();
  }, [loadDashboard, refreshSignal]);

  useFocusEffect(
    useCallback(() => {
      if (!lastOrderEvent && !lastAppStatusEvent) {
        return undefined;
      }

      void loadDashboard();
      return undefined;
    }, [lastAppStatusEvent, lastOrderEvent, loadDashboard])
  );

  const filteredOrders = useMemo(() => {
    if (!selectedDate) {
      return orders;
    }

    return orders.filter((order) => isSameLocalDate(getOrderDateValue(order), selectedDate));
  }, [orders, selectedDate]);

  const displayStats = useMemo(() => {
    if (!selectedDate) {
      return {
        totalOrders: overallStats?.totalOrders ?? 0,
        pendingOrders: overallStats?.pendingOrders ?? 0,
        acceptedOrders: overallStats?.acceptedOrders ?? 0,
        deliveredOrders: overallStats?.deliveredOrders ?? 0,
        cancelledOrders: overallStats?.cancelledOrders ?? 0,
        totalRevenue: overallStats?.totalRevenue ?? 0,
      };
    }

    return getDashboardStats(filteredOrders);
  }, [filteredOrders, overallStats, selectedDate]);

  const displayedOrders = selectedDate ? filteredOrders : orders.slice(0, 5);
  const isDateFilterActive = Boolean(selectedDate);
  const selectedDateLabel = isDateFilterActive ? formatSelectedDateLabel(selectedDate) : "";
  const sectionSubtitle = isDateFilterActive
    ? `Showing orders for ${selectedDateLabel}`
    : "All orders overview";

  const summaryCards = useMemo(
    () => [
      {
        title: "Total Orders",
        value: String(displayStats?.totalOrders ?? 0),
        icon: "receipt-text-outline",
        tone: "primary",
      },
      {
        title: "Pending",
        value: String(displayStats?.pendingOrders ?? 0),
        icon: "clock-outline",
        tone: "warning",
      },
      {
        title: "Accepted",
        value: String(displayStats?.acceptedOrders ?? 0),
        icon: "check-circle-outline",
        tone: "success",
      },
      {
        title: "Delivered",
        value: String(displayStats?.deliveredOrders ?? 0),
        icon: "truck-delivery-outline",
        tone: "info",
      },
      {
        title: "Cancelled",
        value: String(displayStats?.cancelledOrders ?? 0),
        icon: "close-circle-outline",
        tone: "danger",
      },
    ],
    [displayStats]
  );

  const metricCardContainerStyle = useMemo(
    () => ({
      flexBasis: summaryColumns === 1 ? "100%" : "48%",
      maxWidth: summaryColumns === 1 ? "100%" : "48%",
    }),
    [summaryColumns]
  );

  const handleOpenDatePicker = () => {
    DateTimePickerAndroid.open({
      value: selectedDate || new Date(),
      mode: "date",
      display: "calendar",
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          setSelectedDate(date);
        }
      },
    });
  };

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
            void loadDashboard();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={[styles.headerRow, stackHeaderActions && styles.headerRowStacked]}>
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
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTextWrap}>
            <Text style={styles.sectionTitle}>Today at a glance</Text>
            <Text style={styles.sectionSubtitle}>{sectionSubtitle}</Text>
          </View>
          <View style={styles.sectionActions}>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              onPress={handleOpenDatePicker}
            >
              <AppIcon name="calendar-month-outline" size={18} color={colors.primary} />
            </Pressable>
            {isDateFilterActive ? (
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                onPress={() => setSelectedDate(null)}
              >
                <AppIcon name="refresh" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.statsGrid}>
          {summaryCards.map((card) => (
            <DashboardCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
              containerStyle={metricCardContainerStyle}
            />
          ))}
          <RevenueCard
            revenue={formatCurrency(displayStats?.totalRevenue ?? 0)}
            ownerEmail={owner?.email || ""}
            verifyPassword={verifyOwnerPassword}
            visible={isRevenueVisible}
            onShow={() => setIsRevenueVisible(true)}
            onHide={() => setIsRevenueVisible(false)}
            containerStyle={metricCardContainerStyle}
          />
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
          <View style={styles.sectionTextWrap}>
            <Text style={styles.sectionTitle}>
              {isDateFilterActive ? "Orders for selected date" : "Recent Orders"}
            </Text>
            {isDateFilterActive ? (
              <Text style={styles.sectionSubtitle}>Showing orders for {selectedDateLabel}</Text>
            ) : null}
          </View>
          <Pressable onPress={() => navigation.navigate("Orders")}>
            <Text style={styles.linkText}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.ordersList}>
          {displayedOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {isDateFilterActive ? "No orders for this date" : "No recent orders available yet."}
              </Text>
            </View>
          ) : (
            displayedOrders.map((order) => {
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

                  <View
                    style={[
                      styles.orderBottomRow,
                      stackHeaderActions && styles.orderBottomRowStacked,
                    ]}
                  >
                    <Text style={styles.orderMeta}>{formatCurrency(order?.total ?? 0)}</Text>
                    <Text style={styles.orderMeta}>{formatDateTime(getOrderDateValue(order))}</Text>
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
    width: "100%",
    alignSelf: "center",
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
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
    gap: spacing.md,
  },
  sectionTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "600",
  },
  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  iconButtonPressed: {
    opacity: 0.92,
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
    alignItems: "stretch",
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
  orderBottomRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
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

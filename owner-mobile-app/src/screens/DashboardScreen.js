import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import DashboardCard from "../components/DashboardCard";
import { fetchAppStatus, fetchOrderStats, fetchOrders } from "../api/ownerApi";
import { colors, radius, shadow, spacing } from "../theme/theme";
import { computeOrderStats, formatCurrency, formatDateTime } from "../utils/formatters";
import { useSocket } from "../context/SocketContext";

const quickLinks = [
  "Orders",
  "Categories",
  "Menu Items",
  "Banners",
  "App Status",
  "Settings",
];

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { lastOrderEvent, lastAppStatusEvent, isConnected } = useSocket();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [appStatus, setAppStatus] = useState({ isActive: true, message: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsResponse, ordersResponse, appStatusResponse] = await Promise.all([
        fetchOrderStats().catch(() => ({})),
        fetchOrders({ limit: 10 }).catch(() => ({ orders: [] })),
        fetchAppStatus(),
      ]);

      const derivedStats = computeOrderStats(ordersResponse.orders || []);

      setStats({
        totalOrders: statsResponse.totalOrders ?? derivedStats.totalOrders,
        pendingOrders: statsResponse.pendingOrders ?? derivedStats.pendingOrders,
        acceptedOrders: statsResponse.acceptedOrders ?? derivedStats.acceptedOrders,
        deliveredOrders: statsResponse.deliveredOrders ?? derivedStats.deliveredOrders,
        cancelledOrders: statsResponse.cancelledOrders ?? derivedStats.cancelledOrders,
        totalRevenue: statsResponse.totalRevenue ?? derivedStats.totalRevenue,
      });
      setRecentOrders(ordersResponse.orders || []);
      setAppStatus(appStatusResponse);
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

  const handleRefresh = () => {
    setRefreshing(true);
    void loadDashboard();
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Owner Overview</Text>
        <Text style={styles.heroSubtitle}>
          Live backend connected, restaurant control at your fingertips.
        </Text>
        <View style={styles.statusBanner}>
          <Text style={styles.statusLabel}>App Status</Text>
          <Text style={styles.statusValue}>{appStatus.isActive ? "Active" : "Inactive"}</Text>
          <Text style={styles.statusMessage}>{appStatus.message || "No status message"}</Text>
          <Text style={styles.socketState}>{isConnected ? "Socket connected" : "Socket disconnected"}</Text>
        </View>
      </View>

      <View style={styles.cardsRow}>
        <DashboardCard title="Total Orders" value={String(stats?.totalOrders ?? 0)} />
        <DashboardCard title="Pending Orders" value={String(stats?.pendingOrders ?? 0)} tone="gold" />
      </View>
      <View style={styles.cardsRow}>
        <DashboardCard title="Accepted Orders" value={String(stats?.acceptedOrders ?? 0)} tone="success" />
        <DashboardCard title="Delivered Orders" value={String(stats?.deliveredOrders ?? 0)} />
      </View>
      <View style={styles.cardsRow}>
        <DashboardCard title="Cancelled Orders" value={String(stats?.cancelledOrders ?? 0)} tone="accent" />
        <DashboardCard title="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Navigation</Text>
        <View style={styles.quickGrid}>
          {quickLinks.map((screenName) => (
            <DashboardCard
              key={screenName}
              title={screenName}
              value="Open"
              subtitle="Manage now"
              onPress={() => navigation.navigate(screenName)}
              tone="accent"
            />
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recent Orders</Text>
        {recentOrders.length === 0 ? (
          <Text style={styles.emptyText}>No recent orders found.</Text>
        ) : (
          recentOrders.slice(0, 5).map((order) => (
            <View key={order._id || order.orderId} style={styles.recentOrder}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.recentOrderId}>
                  Order #{order.orderId || order._id}
                </Text>
                <Text style={styles.recentOrderMeta}>
                  {order.customerName} • {formatCurrency(order.total)}
                </Text>
                <Text style={styles.recentOrderMeta}>{formatDateTime(order.createdAt)}</Text>
              </View>
              <Text style={styles.recentOrderStatus}>{order.status}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  hero: {
    gap: 12,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  statusBanner: {
    backgroundColor: "rgba(26,20,20,0.86)",
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.45)",
    borderRadius: radius.lg,
    padding: 16,
    gap: 4,
    ...shadow,
  },
  statusLabel: {
    color: "#d9c8ae",
    fontSize: 12,
    textTransform: "uppercase",
  },
  statusValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  statusMessage: {
    color: colors.muted,
    fontSize: 13,
  },
  socketState: {
    color: "#ffe9c2",
    fontSize: 12,
    fontWeight: "700",
  },
  cardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  panel: {
    backgroundColor: "rgba(20,16,16,0.96)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadow,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  recentOrder: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  recentOrderId: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  recentOrderMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  recentOrderStatus: {
    color: "#ffe9c2",
    fontSize: 12,
    fontWeight: "800",
  },
});

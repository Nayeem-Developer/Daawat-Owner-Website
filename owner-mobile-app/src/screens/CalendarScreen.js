import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppButton from "../components/AppButton";
import AppIcon from "../components/AppIcon";
import { fetchOrders } from "../api/ownerApi";
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
import { formatCurrency, formatDateTime } from "../utils/formatters";

const getStartOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const shiftDate = (value, amount) => {
  const date = getStartOfDay(value);
  date.setDate(date.getDate() + amount);
  return date;
};

const getDateKey = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCalendarDate = (value) =>
  getStartOfDay(value).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function CalendarScreen() {
  const { lastOrderEvent } = useSocket();
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getStartOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const lastHandledEvent = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      setError("");
      const response = await fetchOrders({ limit: 100 });
      setOrders(response?.orders || []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load orders for the calendar.");
      Alert.alert("Calendar", loadError?.message || "Failed to load orders for the calendar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadOrders();
    }, [loadOrders])
  );

  useFocusEffect(
    useCallback(() => {
      if (!lastOrderEvent?.receivedAt || lastOrderEvent.receivedAt === lastHandledEvent.current) {
        return undefined;
      }

      lastHandledEvent.current = lastOrderEvent.receivedAt;
      void loadOrders();
      return undefined;
    }, [lastOrderEvent, loadOrders])
  );

  const filteredOrders = useMemo(() => {
    const selectedDateKey = getDateKey(selectedDate);
    return orders.filter((order) => getDateKey(order?.createdAt) === selectedDateKey);
  }, [orders, selectedDate]);

  const isToday = getDateKey(selectedDate) === getDateKey(new Date());

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
            void loadOrders();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.iconWrap}>
            <AppIcon name="calendar-month-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.title}>Calendar</Text>
            <Text style={styles.subtitle}>View orders by date</Text>
          </View>
        </View>

        <Text style={styles.selectedDateText}>{formatCalendarDate(selectedDate)}</Text>

        <View style={styles.dateActionsRow}>
          <AppButton
            label="Previous"
            variant="chip"
            size="sm"
            fullWidth={false}
            leftIcon="arrow-left"
            onPress={() => setSelectedDate((current) => shiftDate(current, -1))}
          />
          <AppButton
            label="Today"
            variant={isToday ? "primary" : "secondary"}
            size="sm"
            fullWidth={false}
            onPress={() => setSelectedDate(getStartOfDay(new Date()))}
          />
          <AppButton
            label="Next"
            variant="chip"
            size="sm"
            fullWidth={false}
            rightIcon="chevron-right"
            onPress={() => setSelectedDate((current) => shiftDate(current, 1))}
          />
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Orders for selected date</Text>
        <Text style={styles.summaryValue}>{filteredOrders.length}</Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <AppIcon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.ordersList}>
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No orders for this date</Text>
            <Text style={styles.emptyText}>Try another day or pull to refresh.</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const statusPalette = getStatusPalette(order?.status || order?.orderStatus);
            const itemCount = Array.isArray(order?.items) ? order.items.length : 0;

            return (
              <View key={order?._id || order?.orderId} style={styles.orderCard}>
                <View style={styles.orderTopRow}>
                  <View style={styles.orderTextWrap}>
                    <Text style={styles.orderId}>Order #{order?.orderId || order?._id}</Text>
                    <Text style={styles.customerName}>{order?.customerName || "Customer"}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusPalette.background,
                        borderColor: statusPalette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusPalette.text }]}>
                      {order?.status || order?.orderStatus || "Unknown"}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <AppIcon name="clock-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metaText}>{formatDateTime(order?.createdAt)}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <AppIcon name="cash-multiple" size={14} color={colors.textSoft} />
                    <Text style={styles.metaText}>{formatCurrency(order?.total ?? 0)}</Text>
                  </View>
                </View>

                <Text style={styles.orderDetails}>
                  {itemCount} {itemCount === 1 ? "item" : "items"} {order?.addressText ? `| ${order.addressText}` : ""}
                </Text>
              </View>
            );
          })
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
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: layout.bottomInset + spacing.xxl,
    gap: spacing.lg,
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
  heroTextWrap: {
    flex: 1,
    gap: spacing.xs,
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
  selectedDateText: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  dateActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "700",
  },
  summaryValue: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "800",
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
  ordersList: {
    gap: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  orderTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  orderTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  orderId: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  customerName: {
    color: colors.textSoft,
    fontSize: typography.small,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: typography.tiny,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaText: {
    color: colors.textSoft,
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  orderDetails: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
  },
});

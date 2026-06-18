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
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
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
import { formatCurrency } from "../utils/formatters";

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

const getOrderDateValue = (order) =>
  order?.createdAt || order?.created_at || order?.date || order?.updatedAt || order?.updated_at;

const isSameLocalDate = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);

  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) {
    return false;
  }

  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const formatSelectedDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const formatter = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";

  return `${weekday}, ${day} ${month} ${year}`.trim();
};

const formatOrderTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function CalendarScreen() {
  const { lastOrderEvent } = useSocket();
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
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

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const orderDate = getOrderDateValue(order);
        return orderDate ? isSameLocalDate(orderDate, selectedDate) : false;
      }),
    [orders, selectedDate]
  );

  const isToday = isSameLocalDate(selectedDate, new Date());

  const handleOpenDatePicker = () => {
    DateTimePickerAndroid.open({
      value: selectedDate,
      mode: "date",
      display: "calendar",
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          setSelectedDate(date);
        }
      },
    });
  };

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

        <View style={styles.dateCard}>
          <View style={styles.dateInfoRow}>
            <View style={styles.dateInfoIconWrap}>
              <AppIcon name="calendar-search-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.dateInfoTextWrap}>
              <Text style={styles.dateLabel}>Selected date</Text>
              <Text style={styles.selectedDateText}>{formatSelectedDate(selectedDate)}</Text>
            </View>
          </View>

          <AppButton
            label="Select Date"
            variant="secondary"
            size="sm"
            fullWidth={false}
            leftIcon="calendar-search-outline"
            onPress={handleOpenDatePicker}
          />
        </View>

        <View style={styles.dateActionsRow}>
          <AppButton
            label="Previous"
            variant="chip"
            size="sm"
            fullWidth={false}
            leftIcon="chevron-left"
            onPress={() => setSelectedDate((current) => shiftDate(current, -1))}
          />
          <AppButton
            label="Today"
            variant={isToday ? "primary" : "secondary"}
            size="sm"
            fullWidth={false}
            onPress={() => setSelectedDate(new Date())}
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
            <Text style={styles.emptyText}>Try another day, use Select Date, or pull to refresh.</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const statusPalette = getStatusPalette(order?.status || order?.orderStatus);
            const orderDate = getOrderDateValue(order);

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

                <View style={styles.orderMetaRow}>
                  <View style={styles.metaChip}>
                    <AppIcon name="cash-multiple" size={14} color={colors.textSoft} />
                    <Text style={styles.metaText}>{formatCurrency(order?.total ?? 0)}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <AppIcon name="clock-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metaText}>{formatOrderTime(orderDate)}</Text>
                  </View>
                </View>
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
  dateCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dateInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dateInfoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  dateInfoTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  dateLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
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
  orderMetaRow: {
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
});

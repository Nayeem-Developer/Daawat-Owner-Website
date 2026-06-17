import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import OrderCard from "../components/OrderCard";
import { fetchOrders, updateOrderStatus } from "../api/ownerApi";
import { useSocket } from "../context/SocketContext";
import { colors, layout, spacing, typography } from "../theme/theme";

const FILTERS = [
  "All",
  "Pending",
  "Accepted",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const matchesFilter = (order, activeFilter) => {
  if (activeFilter === "All") {
    return true;
  }

  const status = String(order?.status || order?.orderStatus || "").toLowerCase();

  if (activeFilter === "Pending") {
    return status === "placed" || status === "pending" || status.includes("pending");
  }

  if (activeFilter === "Accepted") {
    return status === "accepted" || status === "confirmed";
  }

  if (activeFilter === "Out for Delivery") {
    return status.includes("out for delivery");
  }

  if (activeFilter === "Delivered") {
    return status.includes("delivered");
  }

  if (activeFilter === "Cancelled") {
    return status.includes("cancel") || status.includes("reject") || status.includes("expired");
  }

  return true;
};

export default function OrdersScreen() {
  const { lastOrderEvent } = useSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [pendingAction, setPendingAction] = useState({ orderId: "", status: "" });
  const lastHandledEvent = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetchOrders({ limit: 100 });
      setOrders(response.orders || []);
    } catch (error) {
      Alert.alert("Orders", error?.message || "Failed to load orders");
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

      if (["new_order", "order_created"].includes(lastOrderEvent.eventName)) {
        Alert.alert("New Order", "A new order arrived. The list has been refreshed.");
      }

      return undefined;
    }, [lastOrderEvent, loadOrders])
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const searchable = [
        order?.customerName,
        order?.phone,
        order?.orderId,
        order?.addressText,
        order?.status,
        ...(Array.isArray(order?.items) ? order.items.map((item) => item?.name || item?.itemName) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter(order, activeFilter) && searchable.includes(term);
    });
  }, [activeFilter, orders, search]);

  const handleStatusUpdate = async (orderId, nextStatus) => {
    try {
      setPendingAction({ orderId, status: nextStatus });
      const updated = await updateOrderStatus(orderId, nextStatus);
      setOrders((current) =>
        current.map((item) => (item._id === orderId ? { ...item, ...updated } : item))
      );
      Alert.alert("Success", `Order moved to ${nextStatus}.`);
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Unable to update order status");
    } finally {
      setPendingAction({ orderId: "", status: "" });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item._id || item.orderId}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            pendingStatus={pendingAction.orderId === item._id ? pendingAction.status : ""}
            onStatusPress={(nextStatus) => handleStatusUpdate(item._id, nextStatus)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Orders</Text>
            <Text style={styles.subtitle}>Track every order and update statuses quickly.</Text>
            <AppInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search customer, phone, order ID, address, item..."
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((filter) => (
                <AppButton
                  key={filter}
                  label={filter}
                  variant={activeFilter === filter ? "primary" : "chip"}
                  size="sm"
                  onPress={() => setActiveFilter(filter)}
                  fullWidth={false}
                />
              ))}
            </ScrollView>
            <Text style={styles.resultText}>{filteredOrders.length} orders</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No orders found.</Text>}
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
      />
    </View>
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
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
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
  filterRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resultText: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  listContent: {
    padding: layout.screenPadding,
    paddingBottom: layout.bottomInset + spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    textAlign: "center",
    marginTop: spacing.xxxl,
  },
});

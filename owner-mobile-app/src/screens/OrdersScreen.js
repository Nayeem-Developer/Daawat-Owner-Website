import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import OrderCard from "../components/OrderCard";
import { fetchOrders, updateOrderStatus } from "../api/ownerApi";
import { useSocket } from "../context/SocketContext";
import { colors, radius, spacing } from "../theme/theme";

export default function OrdersScreen() {
  const { lastOrderEvent } = useSocket();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState({ orderId: "", status: "" });
  const lastHandledEvent = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetchOrders({ limit: 100 });
      setOrders(response.orders);
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

  useFocusEffect(
    useCallback(() => {
      const term = search.trim().toLowerCase();
      if (!term) {
        setFilteredOrders(orders);
        return undefined;
      }

      setFilteredOrders(
        orders.filter((order) =>
          [
            order.customerName,
            order.phone,
            order.orderId,
            order.addressText,
            order.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      );
      return undefined;
    }, [orders, search])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void loadOrders();
  };

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
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>Latest orders first with live backend refresh.</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer, phone, order ID, address, status..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No orders found.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
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
    padding: spacing.md,
    gap: 10,
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
  searchInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.text,
    paddingHorizontal: 14,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 24,
    gap: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
});

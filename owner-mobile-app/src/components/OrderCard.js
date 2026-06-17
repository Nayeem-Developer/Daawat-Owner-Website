import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "./AppButton";
import { colors, radius, shadow } from "../theme/theme";
import { formatCurrency, formatDateTime, getOrderItemName } from "../utils/formatters";

export default function OrderCard({ order, onStatusPress, pendingStatus = "" }) {
  const status = order?.status || order?.orderStatus || "Placed";
  const actions = getActionsForStatus(status);

  return (
    <View style={[styles.card, status === "Cancelled" && styles.cancelledCard]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.orderId}>Order #{order?.orderId || order?._id}</Text>
          <Text style={styles.time}>{formatDateTime(order?.createdAt)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <InfoRow label="Customer" value={order?.customerName || "N/A"} />
        <InfoRow label="Phone" value={order?.phone || "N/A"} />
        <InfoRow label="Address" value={order?.addressText || order?.address || "N/A"} />
        <InfoRow label="Payment" value={order?.paymentMethod || "N/A"} />
        <InfoRow label="Payment Status" value={order?.paymentStatus || "Pending"} />
        <InfoRow label="Total" value={formatCurrency(order?.total || 0)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ordered Items</Text>
        {Array.isArray(order?.items) && order.items.length > 0 ? (
          order.items.map((item, index) => (
            <View key={`${item?._id || item?.itemId || index}`} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{getOrderItemName(item)}</Text>
                <Text style={styles.itemMeta}>
                  Qty {item?.quantity || item?.qty || 1} x{" "}
                  {formatCurrency(item?.price || item?.unitPrice || item?.menuItem?.price || 0)}
                </Text>
              </View>
              <Text style={styles.itemLineTotal}>
                {formatCurrency(
                  (item?.quantity || item?.qty || 1) *
                    (item?.price || item?.unitPrice || item?.menuItem?.price || 0)
                )}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No items found.</Text>
        )}
      </View>

      {(order?.latitude && order?.longitude) ? (
        <Pressable
          onPress={() =>
            Linking.openURL(`https://www.google.com/maps?q=${order.latitude},${order.longitude}`)
          }
        >
          <Text style={styles.mapLink}>Open Location</Text>
        </Pressable>
      ) : null}

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <AppButton
              key={action.status}
              label={pendingStatus === action.status ? "Please wait..." : action.label}
              variant={action.variant}
              onPress={() => onStatusPress(action.status)}
              disabled={Boolean(pendingStatus)}
              loading={pendingStatus === action.status}
              fullWidth={false}
              style={styles.actionButton}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const getActionsForStatus = (status) => {
  if (status === "Placed") {
    return [
      { label: "Accept", status: "Accepted", variant: "success" },
      { label: "Reject", status: "Cancelled", variant: "danger" },
    ];
  }

  if (status === "Accepted") {
    return [
      { label: "Out for Delivery", status: "Out for delivery", variant: "primary" },
      { label: "Cancelled", status: "Cancelled", variant: "danger" },
    ];
  }

  if (status === "Out for delivery") {
    return [
      { label: "Delivered", status: "Delivered", variant: "success" },
      { label: "Cancelled", status: "Cancelled", variant: "danger" },
    ];
  }

  return [];
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(23,18,18,0.92)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
    ...shadow,
  },
  cancelledCard: {
    borderColor: "rgba(201,66,66,0.55)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  orderId: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  time: {
    color: colors.muted,
    fontSize: 12,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: "#ffe9c2",
    fontSize: 12,
    fontWeight: "700",
  },
  grid: {
    gap: 8,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
  },
  section: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    gap: 12,
  },
  itemName: {
    color: "#fff0d4",
    fontSize: 15,
    fontWeight: "600",
  },
  itemMeta: {
    color: "#ebdecd",
    fontSize: 13,
  },
  itemLineTotal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
  },
  mapLink: {
    color: "#ffd488",
    fontSize: 14,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
  },
});

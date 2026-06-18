import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import AppIcon from "./AppIcon";
import AppButton from "./AppButton";
import {
  colors,
  getStatusPalette,
  radius,
  shadow,
  spacing,
  typography,
} from "../theme/theme";
import { formatCurrency, formatDateTime, getOrderItemName } from "../utils/formatters";

const getActionsForStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (
    normalized === "placed" ||
    normalized === "pending" ||
    normalized.includes("pending confirmation")
  ) {
    return [
      {
        label: "Accept",
        status: "Accepted",
        variant: "success",
        icon: "check-circle-outline",
      },
      {
        label: "Reject",
        status: "Rejected",
        variant: "danger",
        icon: "close-circle-outline",
      },
    ];
  }

  if (normalized === "accepted" || normalized === "confirmed") {
    return [
      {
        label: "Out for Delivery",
        status: "Out for delivery",
        variant: "primary",
        icon: "truck-delivery-outline",
      },
      {
        label: "Cancel",
        status: "Cancelled",
        variant: "ghost",
        icon: "close-circle-outline",
      },
    ];
  }

  if (normalized === "out for delivery") {
    return [
      {
        label: "Delivered",
        status: "Delivered",
        variant: "success",
        icon: "truck-delivery-outline",
      },
    ];
  }

  return [];
};

const MetaChip = ({ icon, label }) => (
  <View style={styles.metaChip}>
    <AppIcon name={icon} size={14} color={colors.textSoft} />
    <Text style={styles.metaChipText}>{label}</Text>
  </View>
);

export default function OrderCard({ order, onStatusPress, pendingStatus = "" }) {
  const { width } = useWindowDimensions();
  const status = order?.status || order?.orderStatus || "Placed";
  const statusPalette = getStatusPalette(status);
  const actions = getActionsForStatus(status);
  const isCompact = width < 390;

  return (
    <View style={styles.card}>
      <View style={[styles.header, isCompact && styles.headerStacked]}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={styles.orderId}>Order #{order?.orderId || order?._id}</Text>
          <Text style={styles.time}>{formatDateTime(order?.createdAt)}</Text>
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
          <AppIcon name={statusPalette.icon} size={14} color={statusPalette.text} />
          <Text style={[styles.statusText, { color: statusPalette.text }]}>{status}</Text>
        </View>
      </View>

      <View style={[styles.summaryRow, isCompact && styles.summaryRowStacked]}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={styles.customerName}>{order?.customerName || "Customer"}</Text>
          <Text style={styles.customerMeta}>{order?.phone || "Phone not available"}</Text>
        </View>
        <View style={[styles.totalBlock, isCompact && styles.totalBlockCompact]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(order?.total || 0)}</Text>
        </View>
      </View>

      <Text style={styles.address}>{order?.addressText || order?.address || "Address not available"}</Text>

      <View style={styles.metaRow}>
        <MetaChip icon="credit-card-outline" label={order?.paymentMethod || "N/A"} />
        <MetaChip icon="cash-check" label={order?.paymentStatus || "Pending"} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {Array.isArray(order?.items) && order.items.length > 0 ? (
          order.items.slice(0, 4).map((item, index) => (
            <View key={`${item?._id || item?.itemId || index}`} style={styles.itemRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.itemName}>{getOrderItemName(item)}</Text>
                <Text style={styles.itemMeta}>
                  Qty {item?.quantity || item?.qty || 1} |{" "}
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

      {order?.latitude && order?.longitude ? (
        <Pressable
          style={styles.locationButton}
          onPress={() =>
            Linking.openURL(`https://www.google.com/maps?q=${order.latitude},${order.longitude}`)
          }
        >
          <AppIcon name="map-marker-outline" size={16} color={colors.primary} />
          <Text style={styles.locationText}>Open location</Text>
        </Pressable>
      ) : null}

      {actions.length > 0 ? (
        <View style={[styles.actions, isCompact && styles.actionsStacked]}>
          {actions.map((action) => (
            <AppButton
              key={action.status}
              label={pendingStatus === action.status ? "Please wait..." : action.label}
              variant={action.variant}
              size="sm"
              leftIcon={action.icon}
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  headerStacked: {
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  orderId: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  time: {
    color: colors.muted,
    fontSize: typography.tiny,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: typography.tiny,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  summaryRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  customerName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
  },
  customerMeta: {
    color: colors.textSoft,
    fontSize: typography.small,
  },
  totalBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  totalBlockCompact: {
    alignItems: "flex-start",
  },
  totalLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    textTransform: "uppercase",
  },
  totalValue: {
    color: colors.primary,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  address: {
    color: colors.textSoft,
    fontSize: typography.small,
    lineHeight: 19,
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
  metaChipText: {
    color: colors.textSoft,
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  itemName: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "600",
  },
  itemMeta: {
    color: colors.muted,
    fontSize: typography.tiny,
  },
  itemLineTotal: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  locationText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionsStacked: {
    flexDirection: "column",
  },
  actionButton: {
    flexGrow: 1,
    width: "100%",
  },
});

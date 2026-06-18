import { useEffect } from "react";
import { BackHandler, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import AppButton from "./AppButton";
import AppIcon from "./AppIcon";
import {
  colors,
  getStatusPalette,
  radius,
  shadowStrong,
  spacing,
  typography,
} from "../theme/theme";
import {
  formatCurrency,
  formatDateTime,
  getOrderItemName,
} from "../utils/formatters";

const DetailRow = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIconWrap}>
      <AppIcon name={icon} size={16} color={colors.primary} />
    </View>
    <View style={styles.detailTextWrap}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "N/A"}</Text>
    </View>
  </View>
);

export default function NewOrderAlertModal({
  visible,
  order,
  errorMessage = "",
  pendingStatus = "",
  onAccept,
  onReject,
}) {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [visible]);

  if (!visible || !order) {
    return null;
  }

  const items = Array.isArray(order?.items) ? order.items : [];
  const statusPalette = getStatusPalette(order?.status || order?.orderStatus);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.alertHeader}>
            <View style={styles.alertBadge}>
              <AppIcon name="alert-circle-outline" size={20} color={colors.white} />
            </View>
            <View style={styles.alertHeaderTextWrap}>
              <Text style={styles.alertTitle}>New Order Received</Text>
              <Text style={styles.alertSubtitle}>Immediate action required</Text>
            </View>
          </View>

          <View style={styles.heroStrip}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={styles.orderIdLabel}>Order ID</Text>
              <Text style={styles.orderIdValue}>#{order?.orderId || order?._id}</Text>
              <Text style={styles.orderTime}>{formatDateTime(order?.createdAt)}</Text>
            </View>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: statusPalette.background,
                  borderColor: statusPalette.border,
                },
              ]}
            >
              <Text style={[styles.statusChipText, { color: statusPalette.text }]}>
                {order?.status || order?.orderStatus || "Pending"}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <DetailRow icon="receipt-text-outline" label="Customer" value={order?.customerName} />
            <DetailRow icon="phone-portrait-outline" label="Phone" value={order?.phone} />
            <DetailRow icon="location-outline" label="Address" value={order?.addressText} />
            <DetailRow
              icon="cash-outline"
              label="Total Amount"
              value={formatCurrency(order?.total ?? 0)}
            />
            <DetailRow
              icon="card-outline"
              label="Payment Method"
              value={order?.paymentMethod || "N/A"}
            />
            <DetailRow
              icon="time-outline"
              label="Created Time"
              value={formatDateTime(order?.createdAt)}
            />

            <View style={styles.itemsSection}>
              <Text style={styles.sectionLabel}>Items</Text>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <View key={`${item?._id || item?.itemId || index}`} style={styles.itemRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.itemName}>{getOrderItemName(item)}</Text>
                      <Text style={styles.itemMeta}>
                        Qty {item?.quantity || item?.qty || 1}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      {formatCurrency(
                        (item?.quantity || item?.qty || 1) *
                          (item?.price || item?.unitPrice || item?.menuItem?.price || 0)
                      )}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyItems}>No items found.</Text>
              )}
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <AppButton
              label={pendingStatus === "Rejected" ? "Rejecting..." : "Reject Order"}
              variant="danger"
              size="md"
              leftIcon="close-circle-outline"
              onPress={onReject}
              loading={pendingStatus === "Rejected"}
              disabled={Boolean(pendingStatus)}
              style={styles.actionButton}
            />
            <AppButton
              label={pendingStatus === "Accepted" ? "Accepting..." : "Accept Order"}
              variant="success"
              size="md"
              leftIcon="check-circle-outline"
              onPress={onAccept}
              loading={pendingStatus === "Accepted"}
              disabled={Boolean(pendingStatus)}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(27, 15, 14, 0.76)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: "92%",
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadowStrong,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
  },
  alertBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  alertHeaderTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  alertTitle: {
    color: colors.white,
    fontSize: typography.section,
    fontWeight: "800",
  },
  alertSubtitle: {
    color: "#f8dfc8",
    fontSize: typography.small,
    fontWeight: "600",
  },
  heroStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.goldSoft,
    borderBottomWidth: 1,
    borderBottomColor: "#efd8b1",
  },
  orderIdLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  orderIdValue: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
  orderTime: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipText: {
    fontSize: typography.tiny,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  detailIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  detailTextWrap: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
    lineHeight: 21,
  },
  itemsSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  itemName: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "700",
  },
  itemMeta: {
    color: colors.muted,
    fontSize: typography.tiny,
  },
  itemPrice: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "800",
  },
  emptyItems: {
    color: colors.muted,
    fontSize: typography.small,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.panel,
  },
  actionButton: {
    flex: 1,
  },
});

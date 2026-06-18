import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "../components/AppIcon";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import { clearAllOrders, fetchAppStatus, updateAppStatus } from "../api/ownerApi";
import { useOrderAlert } from "../context/OrderAlertContext";
import { useSocket } from "../context/SocketContext";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import {
  colors,
  radius,
  shadow,
  shadowStrong,
  spacing,
  typography,
} from "../theme/theme";

const DELETE_ALL_ORDERS_CONFIRM_TEXT = "DELETE ALL ORDERS";

export default function AppStatusScreen() {
  const { lastAppStatusEvent } = useSocket();
  const { requestOrderAlertRefresh } = useOrderAlert();
  const {
    bottomPadding,
    horizontalPadding,
    maxContentWidth,
    stackModalActions,
    topPadding,
  } = useResponsiveScreen();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchAppStatus();
      setStatus(nextStatus);
    } catch (error) {
      Alert.alert("App Status", error?.message || "Failed to load app status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadStatus();
    }, [loadStatus])
  );

  useFocusEffect(
    useCallback(() => {
      if (lastAppStatusEvent) {
        void loadStatus();
      }
      return undefined;
    }, [lastAppStatusEvent, loadStatus])
  );

  const handleToggle = async (nextValue) => {
    try {
      setUpdating(true);
      const nextStatus = await updateAppStatus(nextValue);
      setStatus(nextStatus);
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Unable to update app status");
    } finally {
      setUpdating(false);
    }
  };

  const resetDeleteModalState = useCallback(() => {
    setDeletePassword("");
    setDeleteConfirmText("");
    setShowDeletePassword(false);
    setDeleteError("");
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    if (deleteLoading) {
      return;
    }
    setDeleteModalVisible(false);
    resetDeleteModalState();
  }, [deleteLoading, resetDeleteModalState]);

  const handleOpenDeleteModal = useCallback(() => {
    resetDeleteModalState();
    setDeleteModalVisible(true);
  }, [resetDeleteModalState]);

  const handleDeleteAllOrders = useCallback(async () => {
    const trimmedPassword = String(deletePassword || "").trim();

    if (!trimmedPassword) {
      setDeleteError("Enter your owner password to continue.");
      return;
    }

    if (deleteConfirmText !== DELETE_ALL_ORDERS_CONFIRM_TEXT) {
      setDeleteError('Type "DELETE ALL ORDERS" exactly to confirm.');
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError("");

      await clearAllOrders({
        password: trimmedPassword,
        confirmText: DELETE_ALL_ORDERS_CONFIRM_TEXT,
      });

      setDeleteModalVisible(false);
      resetDeleteModalState();
      await requestOrderAlertRefresh({ broadcast: true });
      Alert.alert("Success", "All orders deleted successfully");
    } catch (error) {
      setDeleteError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to delete orders. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [
    deleteConfirmText,
    deletePassword,
    requestOrderAlertRefresh,
    resetDeleteModalState,
  ]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isActive = status?.isActive !== false;

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
            void loadStatus();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.iconWrap}>
            <AppIcon name="store-check-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.title}>App Status</Text>
            <Text style={styles.subtitle}>
              Control whether customers can place new orders.
            </Text>
          </View>
          <Switch
            value={status?.isActive !== false}
            onValueChange={handleToggle}
            disabled={updating}
            thumbColor={colors.white}
            trackColor={{ false: "#d1c4b8", true: colors.success }}
          />
        </View>

        <View style={styles.statusInfoCard}>
          <Text style={styles.statusLabel}>Current State</Text>
          <Text style={[styles.statusValue, { color: isActive ? colors.success : colors.danger }]}>
            {isActive ? "Active" : "Inactive"}
          </Text>
          <Text style={styles.statusMessage}>
            {isActive ? "Accepting orders" : "Not accepting orders"}
          </Text>
          <Text style={styles.helperText}>Changes apply immediately for new customer orders.</Text>
        </View>
      </View>

      <View style={styles.dangerSection}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.sectionSubtitle}>
            Destructive actions live here. Review carefully before continuing.
          </Text>
        </View>

        <View style={styles.dangerCard}>
          <View style={styles.dangerTopRow}>
            <View style={styles.dangerIconWrap}>
              <AppIcon name="trash-can-outline" size={20} color={colors.danger} />
            </View>
            <View style={styles.dangerTextWrap}>
              <Text style={styles.dangerTitle}>Delete All Orders</Text>
              <Text style={styles.dangerSubtitle}>
                This will permanently remove all order history. Menu, categories, banners,
                and app settings will not be deleted.
              </Text>
            </View>
          </View>

          <AppButton
            label="Delete All Orders"
            variant="danger"
            leftIcon="trash-can-outline"
            onPress={handleOpenDeleteModal}
          />
        </View>
      </View>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDeleteModal}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={[
              styles.modalScroll,
              { paddingHorizontal: horizontalPadding, paddingBottom: bottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}>
                  <AppIcon name="alert-circle-outline" size={20} color={colors.danger} />
                </View>
                <View style={styles.modalTextWrap}>
                  <Text style={styles.modalTitle}>Delete All Orders?</Text>
                  <Text style={styles.modalSubtitle}>
                    This action cannot be undone. Please enter owner password and type
                    {" "}
                    {DELETE_ALL_ORDERS_CONFIRM_TEXT}
                    {" "}
                    to confirm.
                  </Text>
                </View>
              </View>

              <AppInput
                label="Password"
                value={deletePassword}
                onChangeText={(value) => {
                  setDeletePassword(value);
                  if (deleteError) {
                    setDeleteError("");
                  }
                }}
                placeholder="Enter owner password"
                secureTextEntry={!showDeletePassword}
                rightIcon={showDeletePassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowDeletePassword((current) => !current)}
              />

              <AppInput
                label="Confirmation Text"
                value={deleteConfirmText}
                onChangeText={(value) => {
                  setDeleteConfirmText(value);
                  if (deleteError) {
                    setDeleteError("");
                  }
                }}
                placeholder="Type DELETE ALL ORDERS"
                autoCapitalize="characters"
                helperText='Required: "DELETE ALL ORDERS"'
              />

              {deleteError ? (
                <View style={styles.errorCard}>
                  <AppIcon name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{deleteError}</Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.modalActions,
                  stackModalActions && styles.modalActionsStacked,
                ]}
              >
                <AppButton
                  label="Cancel"
                  variant="ghost"
                  fullWidth={false}
                  onPress={handleCloseDeleteModal}
                  style={stackModalActions ? styles.modalActionStacked : styles.modalAction}
                />
                <AppButton
                  label={deleteLoading ? "Deleting..." : "Delete Permanently"}
                  variant="danger"
                  fullWidth={false}
                  loading={deleteLoading}
                  leftIcon={deleteLoading ? undefined : "trash-can-outline"}
                  onPress={() => void handleDeleteAllOrders()}
                  style={stackModalActions ? styles.modalActionStacked : styles.modalAction}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
  },
  statusInfoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statusLabel: {
    color: colors.textSoft,
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusValue: {
    fontSize: typography.section,
    fontWeight: "800",
  },
  statusMessage: {
    color: colors.textSoft,
    fontSize: typography.body,
    fontWeight: "600",
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
  },
  sectionTitleWrap: {
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
    lineHeight: 19,
  },
  dangerSection: {
    gap: spacing.md,
  },
  dangerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "#f1c3bd",
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow,
  },
  dangerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  dangerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },
  dangerTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  dangerTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  dangerSubtitle: {
    color: colors.textSoft,
    fontSize: typography.body,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: spacing.xxl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadowStrong,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },
  modalTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalActionsStacked: {
    flexDirection: "column",
  },
  modalAction: {
    flex: 1,
  },
  modalActionStacked: {
    width: "100%",
  },
});

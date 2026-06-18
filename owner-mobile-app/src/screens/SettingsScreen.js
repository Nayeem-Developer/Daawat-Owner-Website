import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppButton from "../components/AppButton";
import AppIcon from "../components/AppIcon";
import AppInput from "../components/AppInput";
import { changeOwnerPassword } from "../api/ownerApi";
import { useAuth } from "../context/AuthContext";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import {
  colors,
  radius,
  shadow,
  shadowStrong,
  spacing,
  typography,
} from "../theme/theme";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const {
    bottomPadding,
    horizontalPadding,
    maxContentWidth,
    stackModalActions,
    topPadding,
  } = useResponsiveScreen();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetModalState = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError("");
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) {
      return;
    }

    setModalVisible(false);
    resetModalState();
  }, [resetModalState, submitting]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void logout() },
    ]);
  };

  const handleSubmit = async () => {
    const nextCurrentPassword = String(currentPassword || "");
    const nextNewPassword = String(newPassword || "");
    const nextConfirmPassword = String(confirmPassword || "");

    if (!nextCurrentPassword || !nextNewPassword || !nextConfirmPassword) {
      setError("All password fields are required.");
      return;
    }

    if (nextNewPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (nextNewPassword !== nextConfirmPassword) {
      setError("Confirm new password must match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await changeOwnerPassword({
        currentPassword: nextCurrentPassword,
        newPassword: nextNewPassword,
      });

      setModalVisible(false);
      resetModalState();
      Alert.alert("Success", "Password changed successfully. Please login again.", [
        {
          text: "OK",
          onPress: () => {
            void logout();
          },
        },
      ]);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to change password"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
      >
        <View style={styles.headerCard}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your account security and session</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          onPress={() => {
            resetModalState();
            setModalVisible(true);
          }}
        >
          <View style={styles.iconWrap}>
            <AppIcon name="lock-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.cardTitle}>Change Password</Text>
            <Text style={styles.cardSubtitle}>Update owner login password</Text>
          </View>
          <AppIcon name="chevron-right" size={18} color={colors.muted} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          onPress={handleLogout}
        >
          <View style={[styles.iconWrap, styles.logoutIconWrap]}>
            <AppIcon name="logout" size={22} color={colors.danger} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.cardTitle}>Logout</Text>
            <Text style={styles.cardSubtitle}>Sign out of the owner app</Text>
          </View>
          <AppIcon name="chevron-right" size={18} color={colors.muted} />
        </Pressable>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
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
                  <AppIcon name="lock-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.modalTextWrap}>
                  <Text style={styles.modalTitle}>Change Password</Text>
                  <Text style={styles.modalSubtitle}>
                    Update the owner login password used for the website and app.
                  </Text>
                </View>
              </View>

              <AppInput
                label="Current Password"
                value={currentPassword}
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Enter current password"
                secureTextEntry={!showCurrentPassword}
                rightIcon={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowCurrentPassword((current) => !current)}
              />

              <AppInput
                label="New Password"
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Enter new password"
                secureTextEntry={!showNewPassword}
                rightIcon={showNewPassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowNewPassword((current) => !current)}
                helperText="Minimum 8 characters"
              />

              <AppInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                rightIcon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowConfirmPassword((current) => !current)}
              />

              {error ? (
                <View style={styles.errorCard}>
                  <AppIcon name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
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
                  onPress={closeModal}
                  style={stackModalActions ? styles.modalActionStacked : styles.modalAction}
                />
                <AppButton
                  label={submitting ? "Updating..." : "Update Password"}
                  fullWidth={false}
                  loading={submitting}
                  leftIcon={submitting ? undefined : "lock-outline"}
                  onPress={() => void handleSubmit()}
                  style={stackModalActions ? styles.modalActionStacked : styles.modalAction}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    alignSelf: "center",
    gap: spacing.lg,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadow,
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
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow,
  },
  actionCardPressed: {
    opacity: 0.94,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  logoutIconWrap: {
    backgroundColor: colors.dangerSoft,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: typography.small,
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
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
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

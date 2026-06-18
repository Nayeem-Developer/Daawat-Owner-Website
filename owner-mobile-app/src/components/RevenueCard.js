import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppButton from "./AppButton";
import AppIcon from "./AppIcon";
import AppInput from "./AppInput";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import { colors, radius, shadow, shadowStrong, spacing, typography } from "../theme/theme";

const MASKED_REVENUE = "\u20B9\u2022\u2022\u2022\u2022\u2022\u2022";

const getVerifyError = (error) => {
  const message = String(error?.message || "").trim().toLowerCase();

  if (message.includes("incorrect") || message.includes("invalid") || message.includes("password")) {
    return "Incorrect password";
  }

  return "Unable to verify your password right now.";
};

export default function RevenueCard({ revenue, ownerEmail, verifyPassword, visible, onShow, onHide, containerStyle }) {
  const { horizontalPadding, bottomPadding, stackModalActions } = useResponsiveScreen();
  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const hideRevenue = useCallback(() => {
    setModalVisible(false);
    setPassword("");
    setShowPassword(false);
    setError("");
    onHide?.();
  }, [onHide]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setPassword("");
    setShowPassword(false);
    setError("");
  }, []);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }

    timerRef.current = setTimeout(() => {
      hideRevenue();
    }, 120000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hideRevenue, visible]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (visible && previousState === "active" && nextState !== "active") {
        hideRevenue();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hideRevenue, visible]);

  useEffect(() => {
    if (!ownerEmail && visible) {
      hideRevenue();
    }
  }, [hideRevenue, ownerEmail, visible]);

  const handleToggleVisibility = async () => {
    if (visible) {
      hideRevenue();
      return;
    }

    setError("");
    setPassword("");
    setShowPassword(false);
    setModalVisible(true);
  };

  const handleVerify = async () => {
    const trimmedPassword = String(password || "").trim();

    if (!trimmedPassword) {
      setError("Enter your password");
      return;
    }

    try {
      setVerifying(true);
      setError("");
      await verifyPassword(trimmedPassword);
      setModalVisible(false);
      setPassword("");
      setShowPassword(false);
      onShow?.();
    } catch (verifyError) {
      setError(getVerifyError(verifyError));
    } finally {
      setVerifying(false);
    }
  };

  const displayValue = useMemo(() => (visible ? revenue : MASKED_REVENUE), [revenue, visible]);

  return (
    <>
      <View style={[styles.wrapper, containerStyle]}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.iconWrap}>
              <AppIcon name="cash-multiple" size={20} color={colors.gold} />
            </View>
            <Pressable
              style={({ pressed }) => [styles.eyeButton, pressed && styles.eyeButtonPressed]}
              onPress={handleToggleVisibility}
            >
              <AppIcon
                name={visible ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.primary}
              />
            </Pressable>
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.title}>Revenue</Text>
            <Text style={styles.value}>{displayValue}</Text>
            <Text style={styles.subtitle}>
              {visible ? "Visible for 2 minutes" : "Tap the eye icon to view revenue"}
            </Text>
          </View>
        </View>
      </View>

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
                  <Text style={styles.modalTitle}>Verify Owner Password</Text>
                  <Text style={styles.modalSubtitle}>
                    Enter your owner password to view revenue.
                  </Text>
                </View>
              </View>

              <AppInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowPassword((current) => !current)}
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
                  label={verifying ? "Verifying..." : "Verify"}
                  onPress={handleVerify}
                  loading={verifying}
                  fullWidth={false}
                  style={stackModalActions ? styles.modalActionStacked : styles.modalAction}
                  leftIcon={verifying ? undefined : "lock-outline"}
                />
              </View>

              {verifying ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.primary} size="small" />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 124,
    ...shadow,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.goldSoft,
  },
  eyeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  eyeButtonPressed: {
    opacity: 0.92,
  },
  textWrap: {
    gap: spacing.xs,
  },
  title: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
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
  loadingRow: {
    alignItems: "center",
  },
});

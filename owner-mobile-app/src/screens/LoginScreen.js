import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppIcon from "../components/AppIcon";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import { useAuth } from "../context/AuthContext";
import {
  colors,
  layout,
  radius,
  shadowStrong,
  spacing,
  typography,
} from "../theme/theme";

const logo = require("../../assets/branding/daawat-logo.png");

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    console.log("LOGIN_BUTTON_PRESSED");

    if (typeof login !== "function") {
      console.log("OWNER_LOGIN_ERROR:", "Auth login function is not configured");
      setError("Unable to login. Please try again.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await login(email, password);
    } catch (loginError) {
      const message =
        loginError?.response?.data?.message ||
        loginError?.response?.data?.error ||
        loginError?.message ||
        "Unable to login. Please try again.";
      console.log("OWNER_LOGIN_ERROR:", loginError?.response?.data || loginError?.message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logoWrap}>
              <Image source={logo} style={styles.logo} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.eyebrow}>Restaurant Admin</Text>
              <Text style={styles.title}>Daawat Owner</Text>
              <Text style={styles.subtitle}>
                Sign in to manage orders, menu, banners, and restaurant availability.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="daawatbiryani123@gmail.com"
              keyboardType="email-address"
            />
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
                <AppIcon name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <AppButton
              label={loading ? "Signing In..." : "Login"}
              leftIcon="login"
              onPress={handleLogin}
              loading={loading}
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: layout.screenPadding,
    paddingBottom: layout.bottomInset,
    gap: spacing.xl,
  },
  brandBlock: {
    gap: spacing.lg,
    alignItems: "center",
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...shadowStrong,
  },
  logo: {
    width: 82,
    height: 82,
    borderRadius: radius.lg,
  },
  brandText: {
    alignItems: "center",
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadowStrong,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    lineHeight: 18,
  },
});

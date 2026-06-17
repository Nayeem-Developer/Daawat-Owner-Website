import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadow } from "../theme/theme";

const logo = require("../../assets/branding/daawat-logo.png");

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await signIn({ email: email.trim(), password });
    } catch (loginError) {
      setError(loginError?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Image source={logo} style={styles.logo} />
          <Text style={styles.title}>Owner Login</Text>
          <Text style={styles.subtitle}>
            Sign in to manage Daawat orders, menu, banners, and app status.
          </Text>

          <View style={styles.form}>
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="owner@daawat.com"
              keyboardType="email-address"
            />
            <AppInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AppButton
              label={loading ? "Signing In..." : "Login"}
              onPress={handleLogin}
              loading={loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "rgba(20,14,14,0.96)",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
    ...shadow,
  },
  logo: {
    width: 110,
    height: 110,
    alignSelf: "center",
    borderRadius: 18,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  form: {
    gap: 14,
  },
  error: {
    color: "#ff8c8c",
    fontSize: 14,
    fontWeight: "600",
  },
});

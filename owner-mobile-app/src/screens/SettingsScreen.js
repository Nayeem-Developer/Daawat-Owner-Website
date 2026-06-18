import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import {
  colors,
  radius,
  shadow,
  spacing,
  typography,
} from "../theme/theme";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { bottomPadding, horizontalPadding, maxContentWidth, topPadding } = useResponsiveScreen();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void logout() },
    ]);
  };

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
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your session</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutCard, pressed && styles.logoutCardPressed]}
        onPress={handleLogout}
      >
        <View style={styles.logoutIconWrap}>
          <AppIcon name="logout" size={22} color={colors.danger} />
        </View>
        <View style={styles.logoutTextWrap}>
          <Text style={styles.logoutTitle}>Logout</Text>
          <Text style={styles.logoutSubtitle}>Sign out of the owner app</Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    </ScrollView>
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
  logoutCard: {
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
  logoutCardPressed: {
    opacity: 0.94,
  },
  logoutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },
  logoutTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  logoutTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  logoutSubtitle: {
    color: colors.muted,
    fontSize: typography.small,
  },
});

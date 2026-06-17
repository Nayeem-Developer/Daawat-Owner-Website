import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import OrdersScreen from "../screens/OrdersScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import MenuItemsScreen from "../screens/MenuItemsScreen";
import BannersScreen from "../screens/BannersScreen";
import AppStatusScreen from "../screens/AppStatusScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

const Stack = createNativeStackNavigator();
const logo = require("../../assets/branding/daawat-logo.png");

const screenOptions = ({ navigation, route }) => ({
  headerStyle: {
    backgroundColor: colors.backgroundAlt,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: colors.background,
  },
  headerBackTitleVisible: false,
  headerRight:
    route.name === "Settings"
      ? undefined
      : () => (
          <Pressable
            style={styles.headerAction}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </Pressable>
        ),
});

const SplashScreen = () => (
  <View style={styles.splash}>
    <View style={styles.splashLogoWrap}>
      <Image source={logo} style={styles.logo} />
    </View>
    <Text style={styles.splashTitle}>Daawat Owner</Text>
    <Text style={styles.splashSubtitle}>Loading restaurant dashboard</Text>
    <ActivityIndicator color={colors.primary} size="large" />
  </View>
);

export default function OwnerNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isAuthenticated ? (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={screenOptions}
            />
            <Stack.Screen name="Orders" component={OrdersScreen} options={screenOptions} />
            <Stack.Screen
              name="Categories"
              component={CategoriesScreen}
              options={screenOptions}
            />
            <Stack.Screen
              name="Menu Items"
              component={MenuItemsScreen}
              options={screenOptions}
            />
            <Stack.Screen
              name="Banners"
              component={BannersScreen}
              options={screenOptions}
            />
            <Stack.Screen
              name="App Status"
              component={AppStatusScreen}
              options={screenOptions}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={screenOptions}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.xxxl,
  },
  splashLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...shadow,
  },
  splashTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.text,
  },
  splashSubtitle: {
    fontSize: typography.small,
    color: colors.muted,
  },
  logo: {
    width: 82,
    height: 82,
    borderRadius: radius.lg,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
});

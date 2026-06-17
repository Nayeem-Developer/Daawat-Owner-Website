import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import OrdersScreen from "../screens/OrdersScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import MenuItemsScreen from "../screens/MenuItemsScreen";
import BannersScreen from "../screens/BannersScreen";
import AppStatusScreen from "../screens/AppStatusScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { useAuth } from "../context/AuthContext";
import { colors, radius } from "../theme/theme";

const Stack = createNativeStackNavigator();
const logo = require("../../assets/branding/daawat-logo.png");

const screenOptions = ({ navigation }) => ({
  headerStyle: {
    backgroundColor: colors.backgroundAlt,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: "700",
  },
  contentStyle: {
    backgroundColor: colors.background,
  },
  headerShadowVisible: false,
  headerRight: () => (
    <Pressable style={styles.headerAction} onPress={() => navigation.navigate("Settings")}>
      <Text style={styles.headerActionText}>Settings</Text>
    </Pressable>
  ),
});

const SplashScreen = () => (
  <View style={styles.splash}>
    <Image source={logo} style={styles.logo} />
    <Text style={styles.splashTitle}>Daawat Owner</Text>
    <ActivityIndicator color={colors.gold} size="large" />
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
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={screenOptions} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={screenOptions} />
            <Stack.Screen name="Categories" component={CategoriesScreen} options={screenOptions} />
            <Stack.Screen name="Menu Items" component={MenuItemsScreen} options={screenOptions} />
            <Stack.Screen name="Banners" component={BannersScreen} options={screenOptions} />
            <Stack.Screen name="App Status" component={AppStatusScreen} options={screenOptions} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={screenOptions} />
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
    gap: 20,
    backgroundColor: colors.background,
    padding: 24,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: radius.xl,
  },
  headerAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.45)",
    borderRadius: radius.pill,
    backgroundColor: "rgba(213,164,74,0.12)",
  },
  headerActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
});

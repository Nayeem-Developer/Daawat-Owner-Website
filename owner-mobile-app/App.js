import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import OwnerNavigator from "./src/navigation/OwnerNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { OrderAlertProvider } from "./src/context/OrderAlertContext";
import { OwnerOrdersProvider } from "./src/context/OwnerOrdersContext";
import { SocketProvider } from "./src/context/SocketContext";
import NotificationBootstrap from "./src/components/NotificationBootstrap";
import { colors } from "./src/theme/theme";

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <OwnerOrdersProvider>
              <OrderAlertProvider>
                <StatusBar
                  barStyle="dark-content"
                  backgroundColor={colors.background}
                  translucent={false}
                />
                <OwnerNavigator />
                <NotificationBootstrap />
              </OrderAlertProvider>
            </OwnerOrdersProvider>
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import OwnerNavigator from "./src/navigation/OwnerNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { SocketProvider } from "./src/context/SocketContext";
import { colors } from "./src/theme/theme";

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <StatusBar style="light" />
            <OwnerNavigator />
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

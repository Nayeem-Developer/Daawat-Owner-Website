import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <OwnerNavigator />
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

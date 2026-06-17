import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureApiClient } from "../api/apiClient";
import { fetchOwnerProfile, loginOwner } from "../api/ownerApi";

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  token: "daawat_owner_token",
  owner: "daawat_owner_profile",
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureApiClient({
      getToken: async () => (await AsyncStorage.getItem(STORAGE_KEYS.token)) || "",
      onUnauthorized: async () => {
        await signOut();
      },
    });
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedToken, storedOwner] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.token),
          AsyncStorage.getItem(STORAGE_KEYS.owner),
        ]);

        if (storedToken) {
          setToken(storedToken);
        }

        if (storedOwner) {
          setOwner(JSON.parse(storedOwner));
        }
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const signIn = async ({ email, password }) => {
    const result = await loginOwner({ email, password });
    const nextOwner = {
      email,
      name: result.owner?.name || result.owner?.ownerName || "Daawat Owner",
      ...result.owner,
    };

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.token, result.token],
      [STORAGE_KEYS.owner, JSON.stringify(nextOwner)],
    ]);

    setToken(result.token);
    setOwner(nextOwner);

    try {
      const profile = await fetchOwnerProfile();
      if (profile) {
        await AsyncStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(profile));
        setOwner((current) => ({ ...current, ...profile }));
      }
    } catch {
      // Fallback to login response if profile endpoint is unavailable.
    }

    return result;
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.owner]);
    setToken("");
    setOwner(null);
  };

  const value = useMemo(
    () => ({
      token,
      owner,
      isLoading,
      isAuthenticated: Boolean(token),
      signIn,
      signOut,
      setOwner,
    }),
    [isLoading, owner, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};

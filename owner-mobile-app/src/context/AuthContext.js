import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureApiClient } from "../api/apiClient";
import { fetchOwnerProfile, loginOwner } from "../api/ownerApi";

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  token: "daawat_owner_token",
  owner: "daawat_owner_profile",
};

const persistSession = async (token, owner) => {
  await AsyncStorage.setItem(STORAGE_KEYS.token, token);
  await AsyncStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(owner));
};

const clearSession = async () => {
  await AsyncStorage.removeItem(STORAGE_KEYS.token);
  await AsyncStorage.removeItem(STORAGE_KEYS.owner);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const signOut = async () => {
    await clearSession();
    setToken("");
    setOwner(null);
  };

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
    const nextToken = result?.token || "";

    if (!nextToken) {
      throw new Error("Login failed. Token missing.");
    }

    const nextOwner = {
      email,
      name: result.owner?.name || result.owner?.ownerName || "Daawat Owner",
      ...result.owner,
    };

    await persistSession(nextToken, nextOwner);

    setToken(nextToken);
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

  const value = useMemo(
    () => ({
      token,
      owner,
      isLoading,
      isAuthenticated: Boolean(token),
      signIn,
      login: signIn,
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

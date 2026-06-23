import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureApiClient } from '../api/apiClient';
import { loginOwner } from '../api/ownerApi';
import { stopLiveTracking } from '../services/liveTrackingService';
import {
  removeOwnerFcmToken,
  stopOrderAlert,
} from '../services/notificationService';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  token: 'ownerToken',
  owner: 'ownerUser',
  legacyToken: 'daawat_owner_token',
  legacyOwner: 'daawat_owner_profile',
};

const persistSession = async (token, owner) => {
  await AsyncStorage.setItem(STORAGE_KEYS.token, token);
  await AsyncStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(owner));
};

const clearSession = async () => {
  await AsyncStorage.removeItem(STORAGE_KEYS.token);
  await AsyncStorage.removeItem(STORAGE_KEYS.owner);
  await AsyncStorage.removeItem(STORAGE_KEYS.legacyToken);
  await AsyncStorage.removeItem(STORAGE_KEYS.legacyOwner);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    const activeToken = token;

    await removeOwnerFcmToken({ ownerToken: activeToken });
    await stopLiveTracking({ reason: 'manual' });
    await stopOrderAlert();
    await clearSession();
    setToken('');
    setOwner(null);
    setIsAuthenticated(false);
  }, [token]);

  useEffect(() => {
    configureApiClient({
      getToken: async () => {
        const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.token);
        if (storedToken) {
          return storedToken;
        }
        return (await AsyncStorage.getItem(STORAGE_KEYS.legacyToken)) || '';
      },
      onUnauthorized: async () => {
        await logout();
      },
    });
  }, [logout]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedToken, storedOwner, legacyToken, legacyOwner] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.token),
            AsyncStorage.getItem(STORAGE_KEYS.owner),
            AsyncStorage.getItem(STORAGE_KEYS.legacyToken),
            AsyncStorage.getItem(STORAGE_KEYS.legacyOwner),
          ]);

        const nextToken = storedToken || legacyToken || '';
        const nextOwnerRaw = storedOwner || legacyOwner || '';

        if (nextToken) {
          setToken(nextToken);
          setIsAuthenticated(true);

          if (!storedToken && legacyToken) {
            await AsyncStorage.setItem(STORAGE_KEYS.token, legacyToken);
          }
        } else {
          setIsAuthenticated(false);
        }

        if (nextOwnerRaw) {
          try {
            const parsedOwner = JSON.parse(nextOwnerRaw);
            setOwner(parsedOwner);

            if (!storedOwner && legacyOwner) {
              await AsyncStorage.setItem(STORAGE_KEYS.owner, nextOwnerRaw);
            }
          } catch {
            setOwner(null);
          }
        } else {
          setOwner(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const login = useCallback(async (email, password) => {
    const normalizedEmail = String(email || '').trim();
    const result = await loginOwner({ email: normalizedEmail, password });
    const nextToken = result?.token || '';
    const nextOwner = {
      email: normalizedEmail,
      name: result?.owner?.name || result?.owner?.ownerName || 'Daawat Owner',
      ...result?.owner,
    };

    if (!nextToken) {
      throw new Error('Login failed. Token missing from server response.');
    }

    await persistSession(nextToken, nextOwner);

    setToken(nextToken);
    setOwner(nextOwner);
    setIsAuthenticated(true);

    return result;
  }, []);

  const verifyOwnerPassword = useCallback(
    async password => {
      const email = String(owner?.email || '').trim();

      if (!email) {
        throw new Error('Owner email not available.');
      }

      return loginOwner({ email, password });
    },
    [owner],
  );

  const value = useMemo(
    () => ({
      owner,
      token,
      isAuthenticated,
      isLoading,
      login,
      logout,
      verifyOwnerPassword,
      setOwner,
    }),
    [
      isAuthenticated,
      isLoading,
      login,
      logout,
      owner,
      token,
      verifyOwnerPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};

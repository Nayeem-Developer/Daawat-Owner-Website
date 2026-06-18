import axios from "axios";

export const TOKEN_KEY = "ownerToken";
export const AUTH_STORAGE_KEYS = [
  "ownerToken",
  "token",
  "authToken",
  "adminToken",
  "ownerUser",
  "user",
];
export const SESSION_EXPIRED_MESSAGE = "Session expired. Please login again.";
export const SESSION_MESSAGE_KEY = "ownerSessionMessage";
const LOGIN_PATH = "/login";

export const getOwnerToken = () => localStorage.getItem(TOKEN_KEY);

export const clearOwnerSession = () => {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
};

export const consumeSessionMessage = () => {
  const message = sessionStorage.getItem(SESSION_MESSAGE_KEY) || "";
  if (message) {
    sessionStorage.removeItem(SESSION_MESSAGE_KEY);
  }
  return message;
};

const storeSessionMessage = (message) => {
  sessionStorage.setItem(SESSION_MESSAGE_KEY, message);
};

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://daawat-backend.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0,
});

api.interceptors.request.use((config) => {
  const token = getOwnerToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";
    const isOwnerApiRequest = requestUrl.includes("/api/owner");
    const isLoginRequest = requestUrl.includes("/api/owner/login");

    if (status === 401 && isOwnerApiRequest && !isLoginRequest) {
      clearOwnerSession();
      storeSessionMessage(SESSION_EXPIRED_MESSAGE);

      if (typeof window !== "undefined" && window.location.pathname !== LOGIN_PATH) {
        window.location.replace(LOGIN_PATH);
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    return Promise.reject({
      ...error,
      status,
      data: error.response?.data,
      message,
    });
  }
);

export const getErrorMessage = (error, fallback = "Something went wrong") => {
  return error?.message || fallback;
};

export const uploadImage = async (file) => {
  if (!file) {
    throw new Error("No image file selected");
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await api.post("/api/owner/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  console.log("Upload response:", response.data);

  return (
    response.data?.imageUrl ||
    response.data?.data?.imageUrl ||
    response.data?.url ||
    ""
  );
};

export default api;

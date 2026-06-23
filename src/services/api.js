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
export const getOwnerUser = () => {
  const rawValue = localStorage.getItem("ownerUser");
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

export const persistOwnerSession = (token, owner = null) => {
  localStorage.setItem(TOKEN_KEY, token);

  if (owner) {
    localStorage.setItem("ownerUser", JSON.stringify(owner));
  }
};

export const clearOwnerSession = () => {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
};

export const consumeSessionNotice = () => {
  const rawValue = sessionStorage.getItem(SESSION_MESSAGE_KEY) || "";
  if (rawValue) {
    sessionStorage.removeItem(SESSION_MESSAGE_KEY);
  }

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (parsedValue?.message) {
      return parsedValue;
    }
  } catch {
    return {
      type: "error",
      message: rawValue,
    };
  }

  return null;
};

export const storeSessionNotice = (message, type = "info") => {
  sessionStorage.setItem(
    SESSION_MESSAGE_KEY,
    JSON.stringify({
      type,
      message,
    })
  );
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
      storeSessionNotice(SESSION_EXPIRED_MESSAGE, "error");

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

export const getListFromResponseBody = (responseBody, keys = []) => {
  const items = Array.isArray(responseBody?.data)
    ? responseBody.data
    : Array.isArray(responseBody?.items)
      ? responseBody.items
      : Array.isArray(responseBody)
        ? responseBody
        : [];

  if (items.length > 0) {
    return items;
  }

  for (const key of keys) {
    if (Array.isArray(responseBody?.[key])) {
      return responseBody[key];
    }

    if (Array.isArray(responseBody?.data?.[key])) {
      return responseBody.data[key];
    }
  }

  return items;
};

export const sendPromoNotification = async ({
  title,
  body,
  imageUrl = "",
  itemId = "",
  categoryId = "",
}) => {
  const response = await api.post("/api/owner/notifications/promotional/send", {
    title,
    body,
    imageUrl,
    itemId,
    categoryId,
  });

  return response.data;
};

export const savePromoCampaign = async (payload) => {
  const response = await api.post("/api/owner/notifications/promotional/schedule", payload);
  return response.data?.data || response.data?.campaign || response.data;
};

export const getPromoCampaigns = async () => {
  const response = await api.get("/api/owner/notifications/promotional/campaigns");
  return getListFromResponseBody(response.data, ["campaigns"]);
};

export const togglePromoCampaign = async (id) => {
  const response = await api.patch(`/api/owner/notifications/promotional/campaigns/${id}/toggle`);
  return response.data?.data || response.data?.campaign || response.data;
};

export const deletePromoCampaign = async (id) => {
  const response = await api.delete(`/api/owner/notifications/promotional/campaigns/${id}`);
  return response.data;
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

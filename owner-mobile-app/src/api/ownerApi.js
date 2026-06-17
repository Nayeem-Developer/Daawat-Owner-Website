import apiClient from "./apiClient";
import { API_ROUTES } from "../config/apiConfig";
import {
  getListFromResponseBody,
  normalizeOrder,
} from "../utils/formatters";

const getTokenFromResponse = (responseBody) =>
  responseBody?.token ||
  responseBody?.data?.token ||
  responseBody?.jwt ||
  responseBody?.accessToken ||
  "";

const getOwnerFromResponse = (responseBody, email) =>
  responseBody?.owner ||
  responseBody?.user ||
  responseBody?.data?.owner ||
  responseBody?.data?.user ||
  {
    email,
    name: "Daawat Owner",
  };

const getLoginErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  "Unable to login. Please try again.";

export const loginOwner = async (credentials) => {
  console.log("Owner login attempt:", credentials?.email);

  try {
    const response = await apiClient.post(API_ROUTES.ownerLogin, credentials);
    console.log("Owner login response:", response?.data);

    const responseBody = response?.data || {};
    const token = getTokenFromResponse(responseBody);

    if (!token) {
      throw new Error("Login failed. Token missing.");
    }

    return {
      token,
      owner: getOwnerFromResponse(responseBody, credentials?.email),
      raw: responseBody,
    };
  } catch (error) {
    console.log("Owner login error:", error?.response?.data || error.message);
    const normalizedError = new Error(getLoginErrorMessage(error));
    normalizedError.response = error?.response;
    throw normalizedError;
  }
};

export const fetchOwnerProfile = async () => {
  const candidateRoutes = ["/api/auth/me", "/api/owner/me"];

  for (const route of candidateRoutes) {
    try {
      const response = await apiClient.get(route);
      return response?.data?.data || response?.data?.owner || response?.data?.user || response?.data;
    } catch (error) {
      if (error?.status && error.status !== 404) {
        throw error;
      }
    }
  }

  return null;
};

export const fetchOrders = async (params = {}) => {
  const response = await apiClient.get(API_ROUTES.ownerOrders, { params });
  const items = getListFromResponseBody(response?.data, ["orders"])
    .map((order) => normalizeOrder(order))
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

  return {
    orders: items,
    pagination: response?.data?.pagination || response?.data?.data?.pagination || null,
    raw: response?.data,
  };
};

export const fetchOrderStats = async () => {
  const response = await apiClient.get(API_ROUTES.ownerOrderStats);
  return (
    response?.data?.stats ||
    response?.data?.data?.stats ||
    response?.data?.data ||
    {}
  );
};

export const updateOrderStatus = async (orderId, orderStatus) => {
  const response = await apiClient.patch(
    `${API_ROUTES.ownerOrders}/${orderId}/status`,
    { orderStatus }
  );

  return normalizeOrder(
    response?.data?.data || response?.data?.order || response?.data
  );
};

export const fetchAppStatus = async () => {
  const response = await apiClient.get(API_ROUTES.publicAppStatus);
  const payload = response?.data?.data || response?.data || {};

  return {
    isActive: payload?.isActive !== false,
    message: payload?.message || "",
    updatedAt: payload?.updatedAt || null,
  };
};

export const updateAppStatus = async (isActive) => {
  const message = isActive
    ? "Daawat is accepting orders"
    : "Daawat is currently not accepting orders";

  const response = await apiClient.patch(API_ROUTES.ownerAppStatus, {
    isActive,
    message,
  });

  const payload = response?.data?.data || response?.data || {};
  return {
    isActive: payload?.isActive !== false,
    message: payload?.message || message,
    updatedAt: payload?.updatedAt || null,
  };
};

export const fetchCategories = async () => {
  const response = await apiClient.get(API_ROUTES.ownerCategories);
  return getListFromResponseBody(response?.data, ["categories"]);
};

export const createCategory = async (payload) => {
  const response = await apiClient.post(API_ROUTES.ownerCategories, payload);
  return response?.data?.data || response?.data?.category || response?.data;
};

export const updateCategory = async (categoryId, payload) => {
  const response = await apiClient.patch(
    `${API_ROUTES.ownerCategories}/${categoryId}`,
    payload
  );
  return response?.data?.data || response?.data?.category || response?.data;
};

export const deleteCategory = async (categoryId) => {
  const response = await apiClient.delete(`${API_ROUTES.ownerCategories}/${categoryId}`);
  return response?.data;
};

export const fetchMenuItems = async (params = {}) => {
  const response = await apiClient.get(API_ROUTES.ownerMenuItems, { params });
  return getListFromResponseBody(response?.data, ["menuItems", "items"]);
};

export const createMenuItem = async (payload) => {
  const response = await apiClient.post(API_ROUTES.ownerMenuItems, payload);
  return response?.data?.data || response?.data?.menuItem || response?.data?.item || response?.data;
};

export const updateMenuItem = async (itemId, payload) => {
  const response = await apiClient.patch(`${API_ROUTES.ownerMenuItems}/${itemId}`, payload);
  return response?.data?.data || response?.data?.menuItem || response?.data?.item || response?.data;
};

export const deleteMenuItem = async (itemId) => {
  const response = await apiClient.delete(`${API_ROUTES.ownerMenuItems}/${itemId}`);
  return response?.data;
};

export const fetchBanners = async () => {
  const response = await apiClient.get(API_ROUTES.ownerBanners);
  return getListFromResponseBody(response?.data, ["banners"]);
};

export const createBanner = async (payload) => {
  const response = await apiClient.post(API_ROUTES.ownerBanners, payload);
  return response?.data?.data || response?.data?.banner || response?.data;
};

export const updateBanner = async (bannerId, payload) => {
  const response = await apiClient.patch(`${API_ROUTES.ownerBanners}/${bannerId}`, payload);
  return response?.data?.data || response?.data?.banner || response?.data;
};

export const deleteBanner = async (bannerId) => {
  const response = await apiClient.delete(`${API_ROUTES.ownerBanners}/${bannerId}`);
  return response?.data;
};

export const uploadImage = async (asset) => {
  const formData = new FormData();
  formData.append("image", {
    uri: asset.uri,
    name: asset.fileName || asset.name || `upload-${Date.now()}.jpg`,
    type: asset.mimeType || asset.type || "image/jpeg",
  });

  const response = await apiClient.post(API_ROUTES.ownerUpload, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return (
    response?.data?.imageUrl ||
    response?.data?.data?.imageUrl ||
    response?.data?.url ||
    ""
  );
};

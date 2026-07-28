import apiClient from './apiClient';
import { API_ROUTES } from '../config/apiConfig';
import { getListFromResponseBody, normalizeOrder } from '../utils/formatters';
import { getOrderStatusConflictMessage } from '../utils/orderStatus';

const getOwnerFromResponse = (responseBody, email) =>
  responseBody?.owner ||
  responseBody?.user ||
  responseBody?.data?.owner ||
  responseBody?.data?.user || {
    email,
    name: 'Daawat Owner',
  };

const getLoginErrorMessage = error =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  'Unable to login. Please try again.';

export const loginOwner = async ({ email, password }) => {
  console.log('OWNER_LOGIN_REQUEST:', email);

  try {
    const response = await apiClient.post(API_ROUTES.ownerLogin, {
      email,
      password,
    });
    console.log('OWNER_LOGIN_RESPONSE:', response?.data);

    const data = response?.data || {};
    const token =
      data?.token ||
      data?.data?.token ||
      data?.accessToken ||
      data?.data?.accessToken ||
      data?.jwt ||
      '';
    const owner = getOwnerFromResponse(data, email);

    console.log('EXTRACTED_TOKEN:', Boolean(token));
    console.log('EXTRACTED_OWNER:', Boolean(owner));

    if (!token) {
      throw new Error('Login failed. Token missing from server response.');
    }

    return {
      token,
      owner,
      raw: data,
    };
  } catch (error) {
    console.log('OWNER_LOGIN_ERROR:', error?.response?.data || error.message);
    const normalizedError = new Error(getLoginErrorMessage(error));
    normalizedError.response = error?.response;
    throw normalizedError;
  }
};

export const fetchOwnerProfile = async () => {
  const candidateRoutes = ['/api/owner/me'];

  for (const route of candidateRoutes) {
    try {
      const response = await apiClient.get(route, { skipAuthLogout: true });
      return (
        response?.data?.data ||
        response?.data?.owner ||
        response?.data?.user ||
        response?.data
      );
    } catch (error) {
      if (error?.status && error.status !== 401 && error.status !== 404) {
        throw error;
      }
    }
  }

  return null;
};

export const changeOwnerPassword = async ({ currentPassword, newPassword }) => {
  const response = await apiClient.post(API_ROUTES.ownerChangePassword, {
    currentPassword,
    newPassword,
  });

  return response?.data;
};

export const registerOwnerDeviceToken = async ({
  token,
  platform = 'android',
}) => {
  const response = await apiClient.post(API_ROUTES.ownerDeviceToken, {
    token,
    platform,
  });

  return response?.data;
};

export const removeOwnerDeviceToken = async ({ token }) => {
  const response = await apiClient.delete(API_ROUTES.ownerDeviceToken, {
    data: {
      token,
    },
  });

  return response?.data;
};

export const fetchOrders = async (params = {}) => {
  const response = await apiClient.get(API_ROUTES.ownerOrders, { params });
  const items = getListFromResponseBody(response?.data, ['orders'])
    .map(order => normalizeOrder(order))
    .filter(Boolean)
    .sort(
      (left, right) =>
        new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
    );

  return {
    orders: items,
    pagination:
      response?.data?.pagination || response?.data?.data?.pagination || null,
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

export const clearAllOrders = async ({ password, confirmText }) => {
  const response = await apiClient.delete(API_ROUTES.ownerClearAllOrders, {
    data: {
      password,
      confirmText,
    },
  });

  return response?.data;
};

export const updateOrderStatus = async (orderId, orderStatus) => {
  try {
    const response = await apiClient.patch(
      `${API_ROUTES.ownerOrders}/${orderId}/status`,
      { orderStatus },
    );

    return normalizeOrder(
      response?.data?.data || response?.data?.order || response?.data,
    );
  } catch (error) {
    const conflictOrder =
      error?.status === 409
        ? normalizeOrder(
            error?.data?.order ||
              error?.data?.data?.order ||
              error?.data?.data ||
              null,
          )
        : null;

    if (error?.status === 409) {
      const conflictError = new Error(
        getOrderStatusConflictMessage(conflictOrder),
      );
      conflictError.status = 409;
      conflictError.code = 'ORDER_STATUS_CONFLICT';
      conflictError.order = conflictOrder;
      conflictError.response = error?.response;
      throw conflictError;
    }

    throw error;
  }
};

export const updateOrderDeliveryLocation = async (orderId, location) => {
  const response = await apiClient.patch(
    `${API_ROUTES.orderTracking}/${orderId}/delivery-location`,
    location,
  );

  return response?.data?.data || response?.data;
};

export const updateOrderTrackingStatus = async (orderId, trackingStatus) => {
  const response = await apiClient.patch(
    `${API_ROUTES.orderTracking}/${orderId}/tracking-status`,
    { trackingStatus },
  );

  return response?.data?.data || response?.data;
};

export const fetchAppStatus = async () => {
  const response = await apiClient.get(API_ROUTES.publicAppStatus);
  const payload = response?.data?.data || response?.data || {};

  return {
    isActive: payload?.isActive !== false,
    message: payload?.message || '',
    updatedAt: payload?.updatedAt || null,
  };
};

export const updateAppStatus = async isActive => {
  const message = isActive
    ? 'Daawat is accepting orders'
    : 'Daawat is currently not accepting orders';

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
  return getListFromResponseBody(response?.data, ['categories']);
};

export const createCategory = async payload => {
  const response = await apiClient.post(API_ROUTES.ownerCategories, payload);
  return response?.data?.data || response?.data?.category || response?.data;
};

export const updateCategory = async (categoryId, payload) => {
  const response = await apiClient.patch(
    `${API_ROUTES.ownerCategories}/${categoryId}`,
    payload,
  );
  return response?.data?.data || response?.data?.category || response?.data;
};

export const deleteCategory = async categoryId => {
  const response = await apiClient.delete(
    `${API_ROUTES.ownerCategories}/${categoryId}`,
  );
  return response?.data;
};

export const fetchMenuItems = async (params = {}) => {
  const response = await apiClient.get(API_ROUTES.ownerMenuItems, { params });
  return getListFromResponseBody(response?.data, ['menuItems', 'items']);
};

export const sendPromoNotification = async ({
  title,
  body,
  imageUrl = '',
  itemId = '',
  categoryId = '',
}) => {
  const response = await apiClient.post(API_ROUTES.ownerPromoSend, {
    title,
    body,
    imageUrl,
    itemId,
    categoryId,
  });

  return response?.data;
};

export const savePromoCampaign = async payload => {
  const response = await apiClient.post(API_ROUTES.ownerPromoSchedule, payload);
  return response?.data?.data || response?.data?.campaign || response?.data;
};

export const getPromoCampaigns = async () => {
  const response = await apiClient.get(API_ROUTES.ownerPromoCampaigns);
  return getListFromResponseBody(response?.data, ['campaigns']);
};

export const togglePromoCampaign = async id => {
  const response = await apiClient.patch(
    `${API_ROUTES.ownerPromoCampaigns}/${id}/toggle`,
  );
  return response?.data?.data || response?.data?.campaign || response?.data;
};

export const deletePromoCampaign = async id => {
  const response = await apiClient.delete(
    `${API_ROUTES.ownerPromoCampaigns}/${id}`,
  );
  return response?.data;
};

export const createMenuItem = async payload => {
  const response = await apiClient.post(API_ROUTES.ownerMenuItems, payload);
  return (
    response?.data?.data ||
    response?.data?.menuItem ||
    response?.data?.item ||
    response?.data
  );
};

export const updateMenuItem = async (itemId, payload) => {
  const response = await apiClient.patch(
    `${API_ROUTES.ownerMenuItems}/${itemId}`,
    payload,
  );
  return (
    response?.data?.data ||
    response?.data?.menuItem ||
    response?.data?.item ||
    response?.data
  );
};

export const deleteMenuItem = async itemId => {
  const response = await apiClient.delete(
    `${API_ROUTES.ownerMenuItems}/${itemId}`,
  );
  return response?.data;
};

export const fetchBanners = async () => {
  const response = await apiClient.get(API_ROUTES.ownerBanners);
  return getListFromResponseBody(response?.data, ['banners']);
};

export const createBanner = async payload => {
  const response = await apiClient.post(API_ROUTES.ownerBanners, payload);
  return response?.data?.data || response?.data?.banner || response?.data;
};

export const updateBanner = async (bannerId, payload) => {
  const response = await apiClient.patch(
    `${API_ROUTES.ownerBanners}/${bannerId}`,
    payload,
  );
  return response?.data?.data || response?.data?.banner || response?.data;
};

export const deleteBanner = async bannerId => {
  const response = await apiClient.delete(
    `${API_ROUTES.ownerBanners}/${bannerId}`,
  );
  return response?.data;
};

export const uploadImage = async asset => {
  const formData = new FormData();
  formData.append('image', {
    uri: asset.uri,
    name: asset.fileName || asset.name || `upload-${Date.now()}.jpg`,
    type: asset.mimeType || asset.type || 'image/jpeg',
  });

  const response = await apiClient.post(API_ROUTES.ownerUpload, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return (
    response?.data?.imageUrl ||
    response?.data?.data?.imageUrl ||
    response?.data?.url ||
    ''
  );
};

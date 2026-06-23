import apiClient from "./apiClient";

const PROMO_BASE = "/api/owner/notifications/promotional";

export const sendPromoNotification = async ({
  title,
  body,
  imageUrl = "",
  itemId = "",
  categoryId = "",
}) => {
  const response = await apiClient.post(`${PROMO_BASE}/send`, {
    title,
    body,
    imageUrl,
    itemId,
    categoryId,
  });

  return response?.data;
};

export const savePromoCampaign = async (payload) => {
  const response = await apiClient.post(`${PROMO_BASE}/schedule`, payload);
  return response?.data?.data || response?.data?.campaign || response?.data;
};

export const getPromoCampaigns = async () => {
  const response = await apiClient.get(`${PROMO_BASE}/campaigns`);
  const payload = response?.data;

  if (Array.isArray(payload?.campaigns)) {
    return payload.campaigns;
  }

  if (Array.isArray(payload?.data?.campaigns)) {
    return payload.data.campaigns;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

export const togglePromoCampaign = async (id) => {
  const response = await apiClient.patch(`${PROMO_BASE}/campaigns/${id}/toggle`);
  return response?.data?.data || response?.data?.campaign || response?.data;
};

export const deletePromoCampaign = async (id) => {
  const response = await apiClient.delete(`${PROMO_BASE}/campaigns/${id}`);
  return response?.data;
};

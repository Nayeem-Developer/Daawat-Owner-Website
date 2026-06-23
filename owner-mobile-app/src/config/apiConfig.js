export const API_BASE_URL = 'https://daawat-backend.onrender.com';
export const SOCKET_URL = 'https://daawat-backend.onrender.com';

export const API_ROUTES = {
  ownerLogin: '/api/owner/login',
  ownerChangePassword: '/api/owner/change-password',
  ownerDeviceToken: '/api/owner/device-token',
  ownerOrders: '/api/owner/orders',
  orderTracking: '/api/orders',
  ownerOrderStats: '/api/owner/orders/stats',
  ownerClearAllOrders: '/api/owner/orders/clear-all',
  ownerCategories: '/api/owner/categories',
  ownerMenuItems: '/api/owner/menu-items',
  ownerPromoSend: '/api/owner/notifications/promotional/send',
  ownerPromoSchedule: '/api/owner/notifications/promotional/schedule',
  ownerPromoCampaigns: '/api/owner/notifications/promotional/campaigns',
  ownerBanners: '/api/owner/banners',
  ownerUpload: '/api/owner/upload',
  ownerAppStatus: '/api/owner/app-status',
  publicAppStatus: '/api/app-status',
};

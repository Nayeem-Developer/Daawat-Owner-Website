import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

let tokenGetter = async () => null;
let unauthorizedHandler = async () => {};

export const configureApiClient = ({
  getToken = async () => null,
  onUnauthorized = async () => {},
} = {}) => {
  tokenGetter = getToken;
  unauthorizedHandler = onUnauthorized;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenGetter();
  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const normalizedError = {
      ...error,
      status: error.response?.status,
      data: error.response?.data,
      message:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Something went wrong",
    };

    const requestUrl = String(error.config?.url || "");
    const isLoginRequest = requestUrl.includes("/login");

    if (normalizedError.status === 401 && !isLoginRequest) {
      await unauthorizedHandler();
    }

    return Promise.reject(normalizedError);
  }
);

export default apiClient;

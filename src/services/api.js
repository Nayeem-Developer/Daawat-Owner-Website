import axios from "axios";

export const TOKEN_KEY = "daawat_owner_token";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://backend-dawaat.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    return Promise.reject({
      ...error,
      status: error.response?.status,
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

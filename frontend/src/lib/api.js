import axios from "axios";

// In development this is empty and Vite proxies /api to the backend.
// In production (e.g. Render) set VITE_API_URL to the backend origin,
// e.g. https://campaign-api.onrender.com
export const API_ORIGIN = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { "Content-Type": "application/json" },
});

// Resolve a backend-relative asset path (e.g. "/uploads/logo.png") to a full URL
export function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

// Origin to use for public links served by the backend (e.g. /s/:slug surveys)
export function publicBase() {
  return API_ORIGIN || window.location.origin;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && !err.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    const message = err.response?.data?.message || err.message || "Something went wrong";
    return Promise.reject(new Error(message));
  }
);

export default api;

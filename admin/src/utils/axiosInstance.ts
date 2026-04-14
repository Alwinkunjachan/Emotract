import axios from "axios";

export const host = import.meta.env.VITE_BACKEND_URL;
const API_BASE_URL = `${host}/api/v1/`;

// Module-level reference to Auth0's getAccessTokenSilently
type TokenGetter = () => Promise<string>;
let _getAccessTokenSilently: TokenGetter | null = null;

export const setTokenGetter = (fn: TokenGetter) => {
  _getAccessTokenSilently = fn;
};

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    if (_getAccessTokenSilently) {
      try {
        const token = await _getAccessTokenSilently();
        config.headers["Authorization"] = `Bearer ${token}`;
      } catch (error) {
        console.error("Failed to get access token:", error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      console.error("Access denied: Admins only.");
      alert("Access Denied! Only admins can perform this action.");
    }

    if (error.response?.status === 401) {
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

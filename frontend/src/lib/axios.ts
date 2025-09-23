// frontend/src/lib/axios.ts

import axios from "axios";
import { auth } from "./firebase";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    console.log(
      "Axios Interceptor: Current Firebase User:",
      user ? user.uid : "No user"
    );
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error("Axios Interceptor: Error getting ID token:", error);
      }
    } else {
      console.log(
        "Axios Interceptor: No user, no token attached for request to:",
        config.url
      );
    }
    return config;
  },
  (error) => {
    console.error("Axios Interceptor: Request error:", error);
    return Promise.reject(error);
  }
);

export { axiosInstance };

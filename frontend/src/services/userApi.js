import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const userApi = {
  async getMe() {
    const { data } = await axios.get(`${API_URL}/users/me`, { headers: authHeaders() });
    return data.user;
  },
  async updateMe(payload) {
    const { data } = await axios.put(`${API_URL}/users/me`, payload, {
      headers: authHeaders(),
    });
    return data.user;
  },
  async changePassword(currentPassword, newPassword) {
    const { data } = await axios.put(
      `${API_URL}/users/me/password`,
      { currentPassword, newPassword },
      { headers: authHeaders() }
    );
    return data;
  },
};
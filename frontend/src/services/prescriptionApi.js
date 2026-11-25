const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handle = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur");
  return data;
};

export const prescriptionApi = {
  // payload : { conversationId, note, items: [{ productId, quantity, instructions }] }
  create: (payload) =>
    fetch(`${API_URL}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    }).then(handle),

  mine: () => fetch(`${API_URL}/prescriptions/mine`, { headers: authHeaders() }).then(handle),

  sent: () => fetch(`${API_URL}/prescriptions/sent`, { headers: authHeaders() }).then(handle),
};
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

export const marketplaceApi = {
  getAll: () => fetch(`${API_URL}/products`, { headers: authHeaders() }).then(handle),

  // formData contient : name, description, price, category, stock, image (File)
  create: (formData) =>
    fetch(`${API_URL}/products`, {
      method: "POST",
      headers: authHeaders(), // PAS de Content-Type : le navigateur le met tout seul
      body: formData,
    }).then(handle),

  update: (id, formData) =>
    fetch(`${API_URL}/products/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: formData,
    }).then(handle),

  remove: (id) =>
    fetch(`${API_URL}/products/${id}`, { method: "DELETE", headers: authHeaders() }).then(handle),
};

export const orderApi = {
  // items : [{ id, qty }] -> { url } (page de paiement Stripe)
  checkout: async (items) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(`${API_URL}/orders/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    }).then(handle);
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Le serveur met trop de temps à répondre. Réessayez.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
},

  confirm: (sessionId) =>
    fetch(`${API_URL}/orders/confirm?session_id=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(),
    }).then(handle),
};

// Transforme /uploads/... en URL complète pour <img src=...>
export const imageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL.replace(/\/api\/?$/, "")}${path}`;
};
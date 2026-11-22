const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export const analysisApi = {
  // Historique des analyses de peau du patient (avec le dernier avis médical le cas échéant)
  async history() {
    const res = await fetch(`${API_URL}/derma/history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Impossible de charger l'historique");
    return data.analyses;
  },
};

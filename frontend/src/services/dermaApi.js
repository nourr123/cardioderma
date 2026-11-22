const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export const dermaApi = {
  async analyze(file) {
    const body = new FormData();
    body.append("image", file);

    const res = await fetch(`${API_URL}/derma/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body, // pas de Content-Type : le navigateur gère le multipart
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Erreur lors de l'analyse");
    return data;
  },
};
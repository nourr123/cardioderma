const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export const doctorApi = {
  // { stats, toTreat, upcoming, patients }
  async dashboard() {
    const res = await fetch(`${API_URL}/doctor/dashboard`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Impossible de charger votre espace");
    const { stats, toTreat, upcoming, patients } = data;
    return { stats, toTreat, upcoming, patients };
  },
};

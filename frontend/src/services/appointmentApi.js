const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

async function request(path = "", options = {}) {
  const res = await fetch(`${API_URL}/appointments${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Une erreur est survenue");
  return data;
}

export const appointmentApi = {
  // { upcoming: [...], history: [...] }
  async listMine() {
    const { upcoming, history } = await request();
    return { upcoming, history };
  },

  // action : "accept" | "decline" | "cancel" | "complete" -> { appointment, message }
  async act(id, action) {
    const data = await request(`/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    return { appointment: data.appointment, message: data.message };
  },
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}/consultations${path}`, {
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

export const consultationApi = {
  // Médecins (dermatologues) disponibles
  async listMedecins() {
    return (await request("/medecins")).medecins;
  },

  // Ouvre une conversation : nécessite le jeton d'orientation renvoyé par l'analyse IA
  async create(medecinId, referralToken) {
    return (await request("/", { method: "POST", body: JSON.stringify({ medecinId, referralToken }) }))
      .conversation;
  },

  async list() {
    return (await request("/")).conversations;
  },

  async messages(id) {
    return (await request(`/${id}/messages`)).messages;
  },

  // La photo est protégée : un <img src> ne peut pas envoyer le jeton, on la télécharge
  // donc avec l'en-tête Authorization et on la transforme en URL locale (à libérer avec
  // URL.revokeObjectURL quand on n'en a plus besoin).
  async imageUrl(id) {
    const res = await fetch(`${API_URL}/consultations/${id}/image`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!res.ok) throw new Error("Photo indisponible");
    return URL.createObjectURL(await res.blob());
  },

  async markRead(id) {
    await request(`/${id}/read`, { method: "PATCH" });
  },

  // Avis médical (médecin) : { verdict: "confirme" | "nuance" | "infirme", commentaire, recommandations }
  async postOpinion(id, body) {
    return (await request(`/${id}/opinions`, { method: "POST", body: JSON.stringify(body) })).message;
  },

  // Dossier du patient (médecin) : { patient, analyses }
  async patientHistory(id) {
    const { patient, analyses } = await request(`/${id}/patient-history`);
    return { patient, analyses };
  },

  async patientAnalysisImageUrl(id, analysisId) {
    const res = await fetch(`${API_URL}/consultations/${id}/patient-history/${analysisId}/image`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!res.ok) throw new Error("Photo indisponible");
    return URL.createObjectURL(await res.blob());
  },

  // Rendez-vous de la conversation
  async listAppointments(id) {
    return (await request(`/${id}/appointments`)).appointments;
  },

  // body : { startsAt (ISO), durationMin, note } -> { appointment, message }
  async createAppointment(id, body) {
    const data = await request(`/${id}/appointments`, { method: "POST", body: JSON.stringify(body) });
    return { appointment: data.appointment, message: data.message };
  },
};

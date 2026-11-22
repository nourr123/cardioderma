import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

// "Acne and Rosacea Photos" -> "Acne and Rosacea"
export const cleanLabel = (s = "") => s.replace(/_/g, " ").replace(/\s*photos?\s*$/i, "").trim();

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Avis du médecin sur le résultat de l'IA
export const VERDICTS = {
  confirme: {
    label: "Confirme l'analyse de l'IA",
    hint: "Le résultat de l'IA me paraît juste.",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    icon: CheckCircle2,
  },
  nuance: {
    label: "Nuance l'analyse de l'IA",
    hint: "Le résultat est plausible mais je le complète ou le précise.",
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
    icon: AlertTriangle,
  },
  infirme: {
    label: "Ne confirme pas l'analyse de l'IA",
    hint: "Mon appréciation est différente de celle de l'IA.",
    tone: "bg-coral-soft text-coral ring-coral/20",
    icon: XCircle,
  },
};

// Statuts d'un rendez-vous : [libellé, classes du badge, classes du point]
export const APPOINTMENT_STATUS = {
  propose: ["En attente de réponse", "bg-amber-50 text-amber-700", "bg-amber-500"],
  confirme: ["Confirmé", "bg-emerald-50 text-emerald-700", "bg-emerald-500"],
  refuse: ["Refusé", "bg-coral-soft text-coral", "bg-coral"],
  annule: ["Annulé", "bg-gray-100 text-gray-600", "bg-gray-400"],
  termine: ["Terminé", "bg-brand-50 text-brand-700", "bg-brand-600"],
  expire: ["Expiré", "bg-gray-100 text-gray-500", "bg-gray-300"],
};

// Valeur pour <input type="datetime-local"> (heure LOCALE du navigateur)
export const toLocalInput = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const personName = (p, role) => `${role === "medecin" ? "Dr " : ""}${p?.prenom ?? ""} ${p?.nom ?? ""}`.trim();

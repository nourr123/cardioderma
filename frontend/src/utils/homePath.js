import { getUser } from "./getUser";

// ⚠️ À adapter au chemin réel de ta route DoctorSpace dans App.jsx
export const DOCTOR_HOME = "/medecin";

// Médecin = tout utilisateur connecté qui n'est ni patient ni admin
export const isDoctor = (user = getUser()) => {
  const role = String(user?.role || "").toLowerCase();
  return !!role && role !== "patient" && role !== "admin";
};

export const homePath = () => (isDoctor() ? DOCTOR_HOME : "/espace");
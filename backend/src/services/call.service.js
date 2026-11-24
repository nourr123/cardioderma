const Appointment = require("../models/appointment");
const ApiError = require("../utils/ApiError");
const { roleOf, isId, sid } = require("./consultation.service");

const OPENS_BEFORE_MS = 10 * 60 * 1000; // la salle ouvre 10 min avant l'heure
const CLOSES_AFTER_MS = 30 * 60 * 1000; // et reste ouverte 30 min après la fin prévue

// Serveurs STUN (publics) + TURN optionnel (réseaux restrictifs : 4G, entreprise…)
//   TURN_URLS=turn:monserveur:3478,turns:monserveur:5349  TURN_USERNAME=...  TURN_CREDENTIAL=...
const iceServers = () => {
  const servers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const urls = (process.env.TURN_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return servers;
};

// Vérifie que l'utilisateur peut rejoindre la consultation vidéo de ce rendez-vous.
// 404 si ce n'est pas le sien (on ne révèle pas l'existence du rendez-vous).
const getCallAccess = async (user, appointmentId, now = Date.now()) => {
  if (!isId(appointmentId)) throw new ApiError(404, "Rendez-vous introuvable");

  const appt = await Appointment.findById(appointmentId)
    .populate("patient", "nom prenom")
    .populate("medecin", "nom prenom specialite");
  if (!appt) throw new ApiError(404, "Rendez-vous introuvable");

  const role = roleOf(user);
  const mine = role === "patient" ? sid(appt.patient) === sid(user) : sid(appt.medecin) === sid(user);
  if (!mine) throw new ApiError(404, "Rendez-vous introuvable");

  if (appt.status !== "confirme") throw new ApiError(409, "Ce rendez-vous n'est pas confirmé");

  const start = new Date(appt.startsAt).getTime();
  const end = new Date(appt.endsAt).getTime();
  if (now < start - OPENS_BEFORE_MS) {
    throw new ApiError(409, "La consultation ouvre 10 minutes avant l'heure prévue");
  }
  if (now > end + CLOSES_AFTER_MS) throw new ApiError(409, "Ce rendez-vous est terminé");

  const other = role === "patient" ? appt.medecin : appt.patient;
  return {
    role,
    appointment: { id: sid(appt), startsAt: appt.startsAt, endsAt: appt.endsAt, durationMin: appt.durationMin },
    peer: { id: sid(other), nom: other?.nom, prenom: other?.prenom },
  };
};

module.exports = { getCallAccess, iceServers, OPENS_BEFORE_MS, CLOSES_AFTER_MS };

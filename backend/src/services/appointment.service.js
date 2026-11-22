const Appointment = require("../models/appointment");
const ApiError = require("../utils/ApiError");
const consultation = require("./consultation.service");

const { roleOf, isId, sid } = consultation;

const DURATIONS = [15, 30, 45, 60]; // minutes
const MIN_LEAD_MS = 10 * 60 * 1000; // pas de rendez-vous dans moins de 10 minutes
const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000; // ni à plus de 90 jours
const MAX_OPEN_PER_CONVERSATION = 5; // propositions en attente simultanées
const MAX_NOTE = 300;
const TZ = process.env.APP_TIMEZONE || "Africa/Tunis";

const OPEN = ["propose", "confirme"];

const formatDate = (d) =>
  new Date(d).toLocaleString("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ------------------------------ Sérialisation ----------------------------- */

const person = (u) =>
  u && u._id ? { id: sid(u), nom: u.nom, prenom: u.prenom, specialite: u.specialite } : { id: sid(u) };

// Une proposition restée sans réponse après l'heure prévue est "expirée"
const effectiveStatus = (a) =>
  a.status === "propose" && new Date(a.startsAt) <= new Date() ? "expire" : a.status;

const serialize = (a) => ({
  id: sid(a),
  conversation: sid(a.conversation),
  patient: person(a.patient),
  medecin: person(a.medecin),
  proposedBy: a.proposedBy,
  startsAt: a.startsAt,
  endsAt: a.endsAt,
  durationMin: a.durationMin,
  note: a.note || "",
  status: effectiveStatus(a),
  createdAt: a.createdAt,
});

const populate = (q) => q.populate("patient", "nom prenom").populate("medecin", "nom prenom specialite");

const actorName = (user) =>
  user.role === "medecin" ? `Dr ${user.nom}` : `${user.prenom} ${user.nom}`.trim();

/* ------------------------------- Contrôles -------------------------------- */

// Un rendez-vous CONFIRMÉ occupe le créneau du médecin comme celui du patient
const assertFree = async (appt, excludeId) => {
  const clashes = await Appointment.find({
    status: "confirme",
    startsAt: { $lt: appt.endsAt },
    endsAt: { $gt: appt.startsAt },
  });

  const busy = clashes.filter(
    (c) =>
      sid(c) !== String(excludeId || "") &&
      (sid(c.medecin) === sid(appt.medecin) || sid(c.patient) === sid(appt.patient))
  );
  if (busy.some((c) => sid(c.medecin) === sid(appt.medecin))) {
    throw new ApiError(409, "Le médecin a déjà un rendez-vous confirmé sur ce créneau");
  }
  if (busy.length) {
    throw new ApiError(409, "Le patient a déjà un rendez-vous confirmé sur ce créneau");
  }
};

/* ------------------------------ Proposer / demander ----------------------- */

// Seul le médecin PROPOSE un créneau ; le patient l'accepte ou le refuse.
const create = async (user, conversationId, body = {}) => {
  const role = roleOf(user);
  const conv = await consultation.getConversationFor(user, conversationId, { populate: false });
  if (role !== "medecin") throw new ApiError(403, "Seul le médecin peut proposer un rendez-vous");

  const startsAt = new Date(body.startsAt);
  if (!body.startsAt || isNaN(startsAt)) throw new ApiError(400, "Date et heure invalides");

  const lead = startsAt.getTime() - Date.now();
  if (lead < MIN_LEAD_MS) {
    throw new ApiError(400, "Choisissez un créneau dans le futur (au moins 10 minutes à l'avance)");
  }
  if (lead > MAX_AHEAD_MS) throw new ApiError(400, "Choisissez un créneau dans les 90 prochains jours");

  const durationMin = Number(body.durationMin ?? 30);
  if (!DURATIONS.includes(durationMin)) {
    throw new ApiError(400, `Durée invalide (${DURATIONS.join(", ")} minutes)`);
  }

  let note = "";
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") throw new ApiError(400, "Note invalide");
    note = body.note.trim();
    if (note.length > MAX_NOTE) throw new ApiError(400, `Note trop longue (${MAX_NOTE} caractères maximum)`);
  }

  const pending = await Appointment.find({ conversation: conv._id, status: "propose" });
  const stillOpen = pending.filter((a) => new Date(a.startsAt) > new Date());
  if (stillOpen.length >= MAX_OPEN_PER_CONVERSATION) {
    throw new ApiError(409, "Trop de propositions en attente : attendez une réponse ou annulez-en une");
  }

  const draft = {
    patient: conv.patient,
    medecin: conv.medecin,
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMin * 60 * 1000),
  };
  await assertFree(draft); // inutile de proposer un créneau déjà pris

  const created = await Appointment.create({
    conversation: conv._id,
    patient: conv.patient,
    medecin: conv.medecin,
    proposedBy: role,
    startsAt,
    endsAt: draft.endsAt,
    durationMin,
    note: note || undefined,
  });

  const appointment = serialize(await populate(Appointment.findById(created._id)));

  const payload = await consultation.createMessage(conv, user, {
    type: "appointment",
    text: `Rendez-vous ${role === "medecin" ? "proposé" : "demandé"} : ${formatDate(startsAt)}`,
    appointment: created._id,
  });

  return { appointment, payload };
};

/* ------------------------------ Répondre / gérer -------------------------- */

const ACTIONS = ["accept", "decline", "cancel", "complete"];

const respond = async (user, appointmentId, action) => {
  const role = roleOf(user);
  if (!ACTIONS.includes(action)) throw new ApiError(400, `Action invalide (${ACTIONS.join(", ")})`);
  if (!isId(appointmentId)) throw new ApiError(404, "Rendez-vous introuvable");

  // L'utilisateur doit faire partie du rendez-vous
  const appt = await Appointment.findOne({ _id: appointmentId, [role]: user._id });
  if (!appt) throw new ApiError(404, "Rendez-vous introuvable");

  const now = new Date();
  let filter, update, message;

  if (action === "accept" || action === "decline") {
    if (appt.proposedBy === role) {
      throw new ApiError(403, "Vous ne pouvez pas répondre à votre propre proposition");
    }
    if (new Date(appt.startsAt) <= now) throw new ApiError(409, "Ce créneau est déjà passé");

    if (action === "accept") await assertFree(appt, sid(appt));

    filter = { _id: appt._id, status: "propose" };
    update = { $set: { status: action === "accept" ? "confirme" : "refuse", respondedAt: now } };
    message = `${actorName(user)} a ${action === "accept" ? "confirmé" : "refusé"} le rendez-vous du ${formatDate(appt.startsAt)}`;
  } else if (action === "cancel") {
    if (!OPEN.includes(appt.status)) throw new ApiError(409, "Ce rendez-vous ne peut plus être annulé");
    filter = { _id: appt._id, status: { $in: OPEN } };
    update = { $set: { status: "annule", cancelledBy: role, respondedAt: now } };
    message = `${actorName(user)} a annulé le rendez-vous du ${formatDate(appt.startsAt)}`;
  } else {
    // complete : seul le médecin, une fois l'heure du rendez-vous arrivée
    if (role !== "medecin") throw new ApiError(403, "Seul le médecin peut terminer une consultation");
    if (appt.status !== "confirme") throw new ApiError(409, "Seul un rendez-vous confirmé peut être terminé");
    if (new Date(appt.startsAt) > now) throw new ApiError(409, "Le rendez-vous n'a pas encore commencé");
    filter = { _id: appt._id, status: "confirme" };
    update = { $set: { status: "termine", respondedAt: now } };
    message = `Consultation du ${formatDate(appt.startsAt)} terminée`;
  }

  // Mise à jour conditionnelle : deux clics simultanés ne passent pas tous les deux
  const updated = await populate(Appointment.findOneAndUpdate(filter, update, { new: true }));
  if (!updated) throw new ApiError(409, "Ce rendez-vous a déjà été traité");

  const conv = await consultation.getConversationFor(user, sid(updated.conversation), { populate: false });
  const payload = await consultation.createMessage(conv, user, { type: "system", text: message });

  return { appointment: serialize(updated), payload };
};

/* --------------------------------- Listes --------------------------------- */

const listForConversation = async (user, conversationId) => {
  const conv = await consultation.getConversationFor(user, conversationId, { populate: false });
  const list = await populate(Appointment.find({ conversation: conv._id }).sort({ startsAt: 1 }));
  return list.map(serialize);
};

// Tous mes rendez-vous : "upcoming" (à venir ou en cours) et "history" (le reste, conservé)
const listMine = async (user) => {
  const role = roleOf(user);
  const list = await populate(Appointment.find({ [role]: user._id }).sort({ startsAt: 1 }).limit(300));
  const now = new Date();

  const upcoming = [];
  const history = [];
  for (const a of list) {
    const s = serialize(a);
    (OPEN.includes(s.status) && new Date(s.endsAt) > now ? upcoming : history).push(s);
  }
  history.reverse(); // le plus récent d'abord
  return { upcoming, history };
};

module.exports = { create, respond, listForConversation, listMine, DURATIONS };

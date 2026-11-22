const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const ApiError = require("../utils/ApiError");
const sendEmail = require("../utils/sendEmail");

// Même dossier que derma.routes.js
const dermaDir = path.join(__dirname, "../../uploads", "derma");

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MAX_TEXT = 2000;
const PAGE_SIZE = 50;

const isId = (v) => mongoose.isValidObjectId(v);
const sid = (v) => String(v?._id ?? v);

/* ------------------------------ Sérialisation ----------------------------- */

const person = (u) =>
  u && u._id ? { id: sid(u), nom: u.nom, prenom: u.prenom, specialite: u.specialite } : { id: sid(u) };

// "viewerRole" : "patient" | "medecin" -> détermine le compteur "unread" renvoyé
const serializeConversation = (c, viewerRole) => ({
  id: sid(c),
  patient: person(c.patient),
  medecin: person(c.medecin),
  analysis: c.analysis,
  hasImage: Boolean(c.image), // le nom du fichier n'est jamais exposé
  lastMessage: c.lastMessage?.text
    ? { text: c.lastMessage.text, sender: sid(c.lastMessage.sender), createdAt: c.lastMessage.createdAt }
    : null,
  unread: c.unread?.[viewerRole] ?? 0,
  updatedAt: c.updatedAt,
});

const serializeMessage = (m) => ({
  id: sid(m),
  conversation: sid(m.conversation),
  sender: sid(m.sender),
  text: m.text,
  createdAt: m.createdAt,
});

/* --------------------------------- Accès ---------------------------------- */

const roleOf = (user) => {
  if (user.role !== "patient" && user.role !== "medecin") {
    throw new ApiError(403, "Accès réservé aux patients et aux médecins");
  }
  return user.role;
};

// Retourne la conversation si l'utilisateur en fait partie, sinon 404
const getConversationFor = async (user, id, { populate = true } = {}) => {
  const role = roleOf(user);
  if (!isId(id)) throw new ApiError(404, "Conversation introuvable");

  let query = Conversation.findOne({ _id: id, [role]: user._id });
  if (populate) {
    query = query.populate("patient", "nom prenom").populate("medecin", "nom prenom specialite");
  }
  const conv = await query;
  if (!conv) throw new ApiError(404, "Conversation introuvable");
  return conv;
};

/* -------------------------------- Médecins -------------------------------- */

// Médecins que le patient peut choisir pour une orientation dermatologique
const listMedecins = async () => {
  const medecins = await User.find({
    role: "medecin",
    statut: "valide",
    estActif: true,
    specialite: /dermatolog/i,
  })
    .select("nom prenom specialite")
    .sort({ nom: 1, prenom: 1 });

  return medecins.map(person);
};

/* ------------------------------ Conversations ----------------------------- */

const createConversation = async (patient, { medecinId, referralToken }) => {
  if (patient.role !== "patient") {
    throw new ApiError(403, "Seul un patient peut demander une consultation");
  }
  if (!isId(medecinId)) throw new ApiError(400, "Médecin invalide");
  if (!referralToken) {
    throw new ApiError(
      400,
      "Aucune orientation médicale : faites d'abord une analyse qui recommande un avis médical"
    );
  }

  // Le jeton est signé par notre serveur lors de l'analyse : il prouve que l'IA a
  // bien recommandé une consultation, et pour CE patient. Le client ne peut pas le fabriquer.
  let payload;
  try {
    payload = jwt.verify(referralToken, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(400, "Orientation expirée : refaites l'analyse de votre photo");
  }
  if (payload.type !== "derma-referral" || payload.uid !== sid(patient)) {
    throw new ApiError(403, "Orientation invalide");
  }

  const medecin = await User.findOne({
    _id: medecinId,
    role: "medecin",
    statut: "valide",
    estActif: true,
  });
  if (!medecin) throw new ApiError(404, "Médecin introuvable ou indisponible");

  let conv;
  let created = true;
  try {
    conv = await Conversation.create({
      patient: patient._id,
      medecin: medecin._id,
      analysis: {
        prediction: payload.prediction,
        confidence: payload.confidence,
        reason: payload.reason,
      },
      // basename : le nom vient d'un jeton signé par nous, mais on garde la précaution
      image: typeof payload.image === "string" ? path.basename(payload.image) : undefined,
      referralId: payload.jti,
    });
  } catch (err) {
    // Même orientation envoyée deux fois : on renvoie la conversation existante
    if (err.code === 11000) {
      conv = await Conversation.findOne({ referralId: payload.jti, patient: patient._id });
      if (!conv) throw err;
      created = false;
    } else {
      throw err;
    }
  }

  const conversation = await Conversation.findById(conv._id)
    .populate("patient", "nom prenom")
    .populate("medecin", "nom prenom specialite");

  return { conversation, created };
};

/* --------------------------------- Photo ---------------------------------- */

// Chemin de la photo, uniquement pour les deux participants de la conversation
const getImagePath = async (user, id) => {
  const conv = await getConversationFor(user, id, { populate: false });
  if (!conv.image) throw new ApiError(404, "Aucune photo pour cette conversation");

  const absolutePath = path.join(dermaDir, path.basename(conv.image));
  if (!fs.existsSync(absolutePath)) throw new ApiError(404, "Photo introuvable sur le serveur");
  return absolutePath;
};

/* ------------------------------ Notification ------------------------------ */

// Prévient le médecin par email. N'échoue jamais : la conversation existe déjà.
// Volontairement AUCUNE donnée médicale dans l'email (hypothèse IA, photo) :
// seulement le nom du patient et un lien vers la messagerie sécurisée.
const notifyNewConversation = async (conv) => {
  try {
    const medecin = await User.findById(conv.medecin._id).select("email nom prenom");
    if (!medecin?.email) return;

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const link = `${clientUrl}/messages/${sid(conv)}`;

    await sendEmail({
      to: medecin.email,
      subject: "Nouveau patient orienté vers vous - CardioDerma",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2>Bonjour Dr ${escapeHtml(medecin.nom)},</h2>
          <p>Un patient, <b>${escapeHtml(conv.patient.prenom)} ${escapeHtml(conv.patient.nom)}</b>,
          a été orienté vers vous après une analyse dermatologique et souhaite échanger avec vous.</p>
          <p>
            <a href="${link}"
               style="background:#0b6355;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">
              Ouvrir la conversation
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Pour des raisons de confidentialité, les informations médicales ne sont consultables que dans la messagerie, après connexion.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Erreur envoi email :", error);
  }
};

const listConversations = async (user) => {
  const role = roleOf(user);
  const convs = await Conversation.find({ [role]: user._id })
    .populate("patient", "nom prenom")
    .populate("medecin", "nom prenom specialite")
    .sort({ updatedAt: -1 });
  return convs.map((c) => serializeConversation(c, role));
};

const getConversation = async (user, id) => {
  const conv = await getConversationFor(user, id);
  return serializeConversation(conv, roleOf(user));
};

/* -------------------------------- Messages -------------------------------- */

const listMessages = async (user, id, { before } = {}) => {
  await getConversationFor(user, id, { populate: false });

  const filter = { conversation: id };
  if (before) {
    const d = new Date(before);
    if (!isNaN(d)) filter.createdAt = { $lt: d };
  }

  const msgs = await Message.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE);
  return msgs.reverse().map(serializeMessage);
};

// Enregistre un message et retourne ce qu'il faut diffuser aux deux participants
const postMessage = async (user, id, rawText) => {
  const role = roleOf(user);
  const other = role === "patient" ? "medecin" : "patient";

  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) throw new ApiError(400, "Le message est vide");
  if (text.length > MAX_TEXT) throw new ApiError(400, `Message trop long (${MAX_TEXT} caractères maximum)`);

  const conv = await getConversationFor(user, id, { populate: false });

  const message = await Message.create({ conversation: conv._id, sender: user._id, text });

  const updated = await Conversation.findByIdAndUpdate(
    conv._id,
    {
      $set: { lastMessage: { text, sender: user._id, createdAt: message.createdAt } },
      $inc: { [`unread.${other}`]: 1 },
    },
    { new: true }
  )
    .populate("patient", "nom prenom")
    .populate("medecin", "nom prenom specialite");

  return {
    message: serializeMessage(message),
    patientId: sid(updated.patient),
    medecinId: sid(updated.medecin),
    forPatient: serializeConversation(updated, "patient"),
    forMedecin: serializeConversation(updated, "medecin"),
  };
};

const markRead = async (user, id) => {
  const role = roleOf(user);
  const conv = await getConversationFor(user, id, { populate: false });
  await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${role}`]: 0 } });
  return { otherUserId: sid(role === "patient" ? conv.medecin : conv.patient) };
};

// Pour Socket.IO : l'autre participant (null si l'utilisateur n'est pas dans la conversation)
const getOtherParticipantId = async (user, id) => {
  const role = roleOf(user);
  if (!isId(id)) return null;
  const conv = await Conversation.findOne({ _id: id, [role]: user._id }).select("patient medecin");
  if (!conv) return null;
  return sid(role === "patient" ? conv.medecin : conv.patient);
};

module.exports = {
  listMedecins,
  createConversation,
  getImagePath,
  notifyNewConversation,
  listConversations,
  getConversation,
  listMessages,
  postMessage,
  markRead,
  getOtherParticipantId,
  serializeConversation,
};
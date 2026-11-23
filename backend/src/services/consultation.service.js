const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Analysis = require("../models/analysis");
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

const serializeMessage = (m) => {
  const type = m.type || "text";
  return {
    id: sid(m),
    conversation: sid(m.conversation),
    sender: sid(m.sender),
    type,
    text: m.text,
    opinion:
      type === "opinion"
        ? {
            verdict: m.opinion?.verdict,
            commentaire: m.opinion?.commentaire,
            recommandations: m.opinion?.recommandations,
          }
        : undefined,
    appointmentId: type === "appointment" && m.appointment ? sid(m.appointment) : undefined,
    createdAt: m.createdAt,
  };
};

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

  // Lien vers l'analyse complète (historique) : on vérifie qu'elle appartient bien à ce patient
  let analysisId;
  if (isId(payload.analysisId)) {
    const analysis = await Analysis.findOne({ _id: payload.analysisId, patient: patient._id });
    if (analysis) analysisId = analysis._id;
  }

  const analysisInfo = {
    prediction: payload.prediction,
    confidence: payload.confidence,
    reason: payload.reason,
  };
  // basename : le nom vient d'un jeton signé par nous, mais on garde la précaution
  const image = typeof payload.image === "string" ? path.basename(payload.image) : undefined;

  // Un seul fil de discussion par patient et par médecin : l'historique est conservé.
  // Une nouvelle analyse est ajoutée à la conversation existante (message d'information).
  let conv = await Conversation.findOne({ patient: patient._id, medecin: medecin._id });
  let created = false;
  let followUp = null;

  if (conv) {
    if (conv.referralId !== payload.jti) {
      const $set = { analysis: analysisInfo, referralId: payload.jti };
      if (analysisId) $set.analysisId = analysisId;
      if (image) $set.image = image;
      await Conversation.updateOne({ _id: conv._id }, { $set });

      const pct = Math.round((Number(payload.confidence) || 0) * 100);
      const label = String(payload.prediction || "")
        .replace(/_/g, " ")
        .replace(/\s*photos?\s*$/i, "")
        .trim();
      followUp = await createMessage(conv, patient, {
        type: "system",
        text: `Nouvelle analyse IA : ${label} (confiance ${pct} %)`,
      });
    }
  } else {
    try {
      conv = await Conversation.create({
        patient: patient._id,
        medecin: medecin._id,
        analysisId,
        analysis: analysisInfo,
        image,
        referralId: payload.jti,
      });
      created = true;
    } catch (err) {
      // Même orientation envoyée deux fois : on renvoie la conversation existante
      if (err.code === 11000) {
        conv = await Conversation.findOne({ referralId: payload.jti, patient: patient._id });
        if (!conv) throw err;
      } else {
        throw err;
      }
    }
  }

  // L'analyse garde le lien vers la conversation (historique du patient)
  if (analysisId) await Analysis.updateOne({ _id: analysisId }, { $set: { conversation: conv._id } });

  const conversation = await Conversation.findById(conv._id)
    .populate("patient", "nom prenom")
    .populate("medecin", "nom prenom specialite");

  return { conversation, created, followUp };
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

// Enregistre un message (de n'importe quel type) dans une conversation DÉJÀ vérifiée,
// met à jour l'aperçu et les non-lus, et retourne ce qu'il faut diffuser aux deux participants.
// "conv" : document de conversation dont l'utilisateur est participant.
const createMessage = async (conv, user, { type = "text", text, opinion, appointment }) => {
  const role = roleOf(user);
  const other = role === "patient" ? "medecin" : "patient";

  const message = await Message.create({
    conversation: conv._id,
    sender: user._id,
    type,
    text,
    opinion,
    appointment,
  });

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

// Message écrit : le type est TOUJOURS "text" ici (un client ne peut pas se faire passer pour un avis)
const postMessage = async (user, id, rawText) => {
  roleOf(user);

  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) throw new ApiError(400, "Le message est vide");
  if (text.length > MAX_TEXT) throw new ApiError(400, `Message trop long (${MAX_TEXT} caractères maximum)`);

  const conv = await getConversationFor(user, id, { populate: false });
  return createMessage(conv, user, { type: "text", text });
};

/* ------------------------------ Avis médical ------------------------------ */

const VERDICTS = {
  confirme: "confirme l'analyse de l'IA",
  nuance: "nuance l'analyse de l'IA",
  infirme: "ne confirme pas l'analyse de l'IA",
};

// Le médecin complète ou nuance le résultat de l'IA. Chaque avis est une NOUVELLE entrée
// de la conversation : rien n'est modifié ni supprimé, l'historique est conservé.
const postOpinion = async (user, id, body = {}) => {
  if (user.role !== "medecin") {
    throw new ApiError(403, "Seul le médecin peut donner un avis médical");
  }

  const { verdict } = body;
  if (typeof verdict !== "string" || !Object.hasOwn(VERDICTS, verdict)) {
    throw new ApiError(400, "Indiquez si vous confirmez, nuancez ou ne confirmez pas l'analyse de l'IA");
  }

  const commentaire = typeof body.commentaire === "string" ? body.commentaire.trim() : "";
  if (!commentaire) throw new ApiError(400, "Votre avis médical est obligatoire");
  if (commentaire.length > MAX_TEXT) throw new ApiError(400, `Avis trop long (${MAX_TEXT} caractères maximum)`);

  let recommandations = "";
  if (body.recommandations !== undefined && body.recommandations !== null) {
    if (typeof body.recommandations !== "string") throw new ApiError(400, "Recommandations invalides");
    recommandations = body.recommandations.trim();
    if (recommandations.length > MAX_TEXT) {
      throw new ApiError(400, `Recommandations trop longues (${MAX_TEXT} caractères maximum)`);
    }
  }

  const conv = await getConversationFor(user, id, { populate: false });

  return createMessage(conv, user, {
    type: "opinion",
    text: `Avis médical : le médecin ${VERDICTS[verdict]}`,
    opinion: { verdict, commentaire, recommandations: recommandations || undefined },
  });
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
  postOpinion,
  createMessage,
  markRead,
  getOtherParticipantId,
  getConversationFor,
  serializeConversation,
  serializeMessage,
  roleOf,
  isId,
  sid,
};

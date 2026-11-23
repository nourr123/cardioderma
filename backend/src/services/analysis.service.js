const Analysis = require("../models/analysis");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const ApiError = require("../utils/ApiError");
const consultation = require("./consultation.service");
const path = require("path");
const fs = require("fs");

const dermaDir = path.join(__dirname, "../../uploads", "derma");

const sid = (v) => String(v?._id ?? v);

// Enregistre une analyse (appelé à chaque analyse, pour l'historique du patient)
const createAnalysis = (patientId, data, image) =>
  Analysis.create({
    patient: patientId,
    prediction: data.prediction,
    confidence: data.confidence,
    top3: (data.top3 || []).map((t) => ({ label: t.class, prob: t.prob })),
    recommendation: data.recommendation,
    reason: data.reason,
    image,
  });

// Historique du patient : ses analyses, et pour celles qui ont mené à une consultation,
// le médecin et son dernier avis médical.
// onlyMedecinId : pour un médecin, on ne détaille que SES consultations
const describe = async (analyses, onlyMedecinId = null) => {
  if (analyses.length === 0) return [];

  // Conversation de chaque analyse : lien direct, ou ancien lien analysisId
  const populateMed = "nom prenom specialite";
  const withFilter = (f) => (onlyMedecinId ? { ...f, medecin: onlyMedecinId } : f);
  const linkedIds = analyses.map((a) => a.conversation).filter(Boolean);
  const byId = linkedIds.length
    ? await Conversation.find(withFilter({ _id: { $in: linkedIds } })).populate("medecin", populateMed)
    : [];
  const byAnalysis = await Conversation.find(
    withFilter({ analysisId: { $in: analyses.map((a) => a._id) } })
  ).populate("medecin", populateMed);

  const convById = new Map([...byId, ...byAnalysis].map((c) => [sid(c), c]));
  const convOf = (a) => (a.conversation && convById.get(sid(a.conversation))) ||
    byAnalysis.find((c) => sid(c.analysisId) === sid(a)) || null;
  const convs = [...convById.values()];

  // Avis des médecins, du plus récent au plus ancien
  const opinions = convs.length
    ? await Message.find({ conversation: { $in: convs.map((c) => c._id) }, type: "opinion" }).sort({
        createdAt: -1,
      })
    : [];

  // Un avis appartient à l'analyse la plus récente qui le précède dans la même conversation
  const opinionFor = (a, conv) => {
    if (!conv) return null;
    const start = new Date(a.createdAt).getTime();
    const sameConv = analyses.filter((x) => convOf(x) && sid(convOf(x)) === sid(conv));
    const next = sameConv
      .map((x) => new Date(x.createdAt).getTime())
      .filter((t) => t > start)
      .sort((x, y) => x - y)[0];
    return (
      opinions.find((m) => {
        if (sid(m.conversation) !== sid(conv)) return false;
        const t = new Date(m.createdAt).getTime();
        return t >= start && (next === undefined || t < next);
      }) || null
    );
  };

  return analyses.map((a) => {
    const conv = convOf(a);
    const op = opinionFor(a, conv);
    return {
      id: sid(a),
      createdAt: a.createdAt,
      prediction: a.prediction,
      confidence: a.confidence,
      top3: a.top3 || [],
      recommendation: a.recommendation,
      reason: a.reason,
      hasImage: Boolean(a.image),
      consultation: conv
        ? {
            conversationId: sid(conv),
            medecin: {
              id: sid(conv.medecin),
              nom: conv.medecin?.nom,
              prenom: conv.medecin?.prenom,
            },
            lastOpinion: op
              ? {
                  verdict: op.opinion?.verdict,
                  commentaire: op.opinion?.commentaire,
                  recommandations: op.opinion?.recommandations,
                  createdAt: op.createdAt,
                }
              : null,
          }
        : null,
    };
  });
};

const listHistory = async (user) => {
  if (user.role !== "patient") throw new ApiError(403, "Réservé aux patients");
  const analyses = await Analysis.find({ patient: user._id }).sort({ createdAt: -1 }).limit(100);
  return describe(analyses);
};

// Dossier d'un patient pour son médecin : accessible uniquement s'il a une conversation avec lui.
const patientHistoryForDoctor = async (user, conversationId) => {
  if (user.role !== "medecin") throw new ApiError(403, "Réservé aux médecins");
  const conv = await consultation.getConversationFor(user, conversationId);
  const analyses = await Analysis.find({ patient: conv.patient._id }).sort({ createdAt: -1 }).limit(200);
  return {
    patient: { id: sid(conv.patient), nom: conv.patient.nom, prenom: conv.patient.prenom },
    analyses: await describe(analyses, user._id),
  };
};

// Photo d'une analyse du patient, pour le médecin concerné uniquement
const analysisImageForDoctor = async (user, conversationId, analysisId) => {
  if (user.role !== "medecin") throw new ApiError(403, "Réservé aux médecins");
  const conv = await consultation.getConversationFor(user, conversationId, { populate: false });
  if (!consultation.isId(analysisId)) throw new ApiError(404, "Photo introuvable");
  const a = await Analysis.findOne({ _id: analysisId, patient: conv.patient });
  if (!a?.image) throw new ApiError(404, "Photo introuvable");
  const file = path.join(dermaDir, path.basename(a.image));
  if (!fs.existsSync(file)) throw new ApiError(404, "Photo introuvable sur le serveur");
  return file;
};

module.exports = { createAnalysis, listHistory, patientHistoryForDoctor, analysisImageForDoctor };

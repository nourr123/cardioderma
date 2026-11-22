const Analysis = require("../models/analysis");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const ApiError = require("../utils/ApiError");

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
const listHistory = async (user) => {
  if (user.role !== "patient") throw new ApiError(403, "Réservé aux patients");

  const analyses = await Analysis.find({ patient: user._id }).sort({ createdAt: -1 }).limit(100);
  if (analyses.length === 0) return [];

  const convs = await Conversation.find({ analysisId: { $in: analyses.map((a) => a._id) } }).populate(
    "medecin",
    "nom prenom specialite"
  );
  const convByAnalysis = new Map(convs.map((c) => [sid(c.analysisId), c]));

  // Dernier avis de chaque conversation (les plus récents d'abord)
  const opinions = convs.length
    ? await Message.find({ conversation: { $in: convs.map((c) => c._id) }, type: "opinion" }).sort({
        createdAt: -1,
      })
    : [];
  const lastOpinion = new Map();
  for (const m of opinions) {
    const key = sid(m.conversation);
    if (!lastOpinion.has(key)) lastOpinion.set(key, m);
  }

  return analyses.map((a) => {
    const conv = convByAnalysis.get(sid(a));
    const op = conv ? lastOpinion.get(sid(conv)) : null;
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

module.exports = { createAnalysis, listHistory };

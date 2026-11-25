const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Analysis = require("../models/analysis");
const ApiError = require("../utils/ApiError");
const appointments = require("./appointment.service");
const { sid } = require("./consultation.service");

const TZ = process.env.APP_TIMEZONE || "Africa/Tunis";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-JJ

const t = (d) => (d ? new Date(d).getTime() : 0);

// Tableau de bord du médecin : uniquement SES patients et SES rendez-vous.
const dashboard = async (user) => {
  if (user.role !== "medecin") throw new ApiError(403, "Réservé aux médecins");

  const convs = await Conversation.find({ medecin: user._id }).populate("patient", "nom prenom");
  const convIds = convs.map((c) => c._id);

  const analysisIds = convs.map((c) => c.analysisId).filter(Boolean);
  const analyses = analysisIds.length ? await Analysis.find({ _id: { $in: analysisIds } }) : [];
  const analysisById = new Map(analyses.map((a) => [sid(a), a]));

  const opinions = convIds.length ? await Message.find({ conversation: { $in: convIds }, type: "opinion" }) : [];
  const lastOpinionAt = new Map();
  for (const m of opinions) {
    const k = sid(m.conversation);
    lastOpinionAt.set(k, Math.max(lastOpinionAt.get(k) || 0, t(m.createdAt)));
  }

  const { upcoming } = await appointments.listMine(user);
  const nextByConv = new Map();
  for (const a of [...upcoming].sort((x, y) => t(x.startsAt) - t(y.startsAt))) {
    if (!nextByConv.has(a.conversation)) nextByConv.set(a.conversation, a);
  }

  const patients = [];
  const toTreat = [];

  for (const c of convs) {
    const analysis = c.analysisId ? analysisById.get(sid(c.analysisId)) : null;
    const analysisAt = analysis?.createdAt ?? c.createdAt;
    const info = {
      conversationId: sid(c),
      patient: { id: sid(c.patient), nom: c.patient?.nom, prenom: c.patient?.prenom },
      lastAnalysis: {
        prediction: analysis?.prediction ?? c.analysis?.prediction,
        confidence: analysis?.confidence ?? c.analysis?.confidence,
        createdAt: analysisAt,
      },
      unread: c.unread?.medecin || 0,
      lastActivity: c.lastMessage?.createdAt ?? c.createdAt,
      nextAppointment: nextByConv.get(sid(c)) ?? null,
    };
    patients.push(info);

    // « À traiter » : l'IA a recommandé une consultation ET aucun avis depuis cette analyse
    const needsDoctor = analysis ? analysis.recommendation === "consultation" : true;
    if (needsDoctor && (lastOpinionAt.get(sid(c)) || 0) < t(analysisAt)) {
      toTreat.push({ ...info, waitingSince: analysisAt });
    }
  }

  patients.sort((a, b) => t(b.lastActivity) - t(a.lastActivity));
  toTreat.sort((a, b) => t(a.waitingSince) - t(b.waitingSince)); // le plus ancien d'abord

  const today = dayKey(Date.now());
  return {
    stats: {
      unread: patients.reduce((n, p) => n + p.unread, 0),
      toTreat: toTreat.length,
      appointmentsToday: upcoming.filter((a) => a.status === "confirme" && dayKey(a.startsAt) === today).length,
      patients: patients.length,
    },
    toTreat,
    upcoming: upcoming.slice(0, 8),
    patients,
  };
};

module.exports = { dashboard };

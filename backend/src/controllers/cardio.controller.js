const crypto = require("crypto");
const mongoose = require("mongoose");
const CardioDevice = require("../models/CardioDevice");
const CardioSession = require("../models/CardioSession");
const CardioMeasure = require("../models/CardioMeasure");
const { isDeviceOnline, notifySession, disconnectDevice } = require("../socket/cardio");

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const uid = (req) => String(req.user._id || req.user.id);
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1
const introuvable = (res) => res.status(404).json({ message: "Introuvable." });

// limite les essais de code d'appairage : 10 par 10 minutes et par adresse IP
const essais = new Map();
function autorise(ip) {
  const now = Date.now();
  const e = essais.get(ip);
  if (!e || e.reset < now) {
    essais.set(ip, { n: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  e.n += 1;
  return e.n <= 10;
}

/* ---------- Dispositif ---------- */
exports.deviceStatus = async (req, res, next) => {
  try {
    const pid = uid(req);
    const dev = await CardioDevice.findOne({ patient: pid });
    res.json({
      paired: !!(dev && dev.keyHash),
      online: isDeviceOnline(pid),
      lastSeen: dev ? dev.lastSeen : null,
      pairingActive: !!(dev && dev.pairingExpires && dev.pairingExpires > new Date()),
    });
  } catch (e) { next(e); }
};

exports.createPairing = async (req, res, next) => {
  try {
    const raw = Array.from(crypto.randomBytes(6), (b) => ALPHA[b % 32]).join("");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await CardioDevice.findOneAndUpdate(
      { patient: uid(req) },
      { $set: { pairingHash: sha(raw), pairingExpires: expiresAt } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ code: `${raw.slice(0, 3)}-${raw.slice(3)}`, expiresAt });
  } catch (e) { next(e); }
};

// Appelé par le Raspberry Pi (sans JWT) : échange le code contre une clé durable
exports.pair = async (req, res, next) => {
  try {
    if (!autorise(req.ip)) {
      return res.status(429).json({ message: "Trop d'essais. Réessayez dans quelques minutes." });
    }
    const raw = String((req.body && req.body.code) || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length !== 6) return res.status(400).json({ message: "Code invalide ou expiré." });

    const cle = crypto.randomBytes(32).toString("hex");
    const dev = await CardioDevice.findOneAndUpdate(
      { pairingHash: sha(raw), pairingExpires: { $gt: new Date() } },
      { $set: { keyHash: sha(cle) }, $unset: { pairingHash: "", pairingExpires: "" } },
      { new: true }
    );
    if (!dev) return res.status(400).json({ message: "Code invalide ou expiré." });

    disconnectDevice(dev.patient);
    res.json({ deviceKey: cle });
  } catch (e) { next(e); }
};

exports.removeDevice = async (req, res, next) => {
  try {
    const pid = uid(req);
    await CardioDevice.updateOne(
      { patient: pid },
      { $unset: { keyHash: "", pairingHash: "", pairingExpires: "", lastSeen: "" } }
    );
    const s = await CardioSession.findOneAndUpdate(
      { patient: pid, status: "active" },
      { $set: { status: "ended", endedAt: new Date() } },
      { new: true }
    );
    if (s) notifySession(pid, null);
    disconnectDevice(pid);
    res.json({ ok: true });
  } catch (e) { next(e); }
};

/* ---------- Sessions ---------- */
exports.activeSession = async (req, res, next) => {
  try {
    const session = await CardioSession.findOne({ patient: uid(req), status: "active" }).lean();
    const measures = session
      ? await CardioMeasure.find({ session: session._id }).select("-ecg").sort({ at: 1 }).lean()
      : [];
    res.json({ session, measures });
  } catch (e) { next(e); }
};

exports.startSession = async (req, res, next) => {
  try {
    const pid = uid(req);
    if (!isDeviceOnline(pid)) {
      return res.status(409).json({ message: "Le dispositif n'est pas connecté." });
    }
    let s = await CardioSession.findOne({ patient: pid, status: "active" });
    if (!s) {
      try {
        s = await CardioSession.create({ patient: pid, startedAt: new Date(), status: "active" });
      } catch (e) {
        if (e.code !== 11000) throw e;
        s = await CardioSession.findOne({ patient: pid, status: "active" });
      }
    }
    notifySession(pid, s);
    res.status(201).json({ session: s });
  } catch (e) { next(e); }
};

exports.stopSession = async (req, res, next) => {
  try {
    const pid = uid(req);
    const s = await CardioSession.findOneAndUpdate(
      { patient: pid, status: "active" },
      { $set: { status: "ended", endedAt: new Date() } },
      { new: true }
    );
    notifySession(pid, null);
    res.json({ session: s });
  } catch (e) { next(e); }
};

exports.listSessions = async (req, res, next) => {
  try {
    const sessions = await CardioSession.find({ patient: uid(req) }).sort({ startedAt: -1 }).limit(50).lean();
    const agg = await CardioMeasure.aggregate([
      { $match: { session: { $in: sessions.map((s) => s._id) } } },
      { $group: { _id: "$session", count: { $sum: 1 }, bpm: { $avg: "$bpm" }, stress: { $avg: "$stress" }, rmssd: { $avg: "$rmssd" } } },
    ]);
    const par = new Map(agg.map((a) => [String(a._id), a]));
    res.json(
      sessions.map((s) => {
        const a = par.get(String(s._id));
        return {
          ...s,
          count: a ? a.count : 0,
          bpmAvg: a ? Math.round(a.bpm) : null,
          stressAvg: a ? Math.round(a.stress) : null,
          rmssdAvg: a ? Math.round(a.rmssd * 10) / 10 : null,
        };
      })
    );
  } catch (e) { next(e); }
};

exports.sessionDetail = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return introuvable(res);
    const session = await CardioSession.findOne({ _id: req.params.id, patient: uid(req) }).lean();
    if (!session) return introuvable(res);
    const measures = await CardioMeasure.find({ session: session._id }).select("-ecg").sort({ at: 1 }).lean();
    res.json({ session, measures });
  } catch (e) { next(e); }
};

exports.measureEcg = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return introuvable(res);
    const m = await CardioMeasure.findOne({ _id: req.params.id, patient: uid(req) }).select("ecg").lean();
    if (!m) return introuvable(res);
    res.json({ ecg: m.ecg });
  } catch (e) { next(e); }
};

exports.deleteSession = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return introuvable(res);
    const s = await CardioSession.findOne({ _id: req.params.id, patient: uid(req) });
    if (!s) return introuvable(res);
    if (s.status === "active") return res.status(409).json({ message: "Arrêtez la session avant de la supprimer." });
    await CardioMeasure.deleteMany({ session: s._id });
    await s.deleteOne();
    res.json({ ok: true });
  } catch (e) { next(e); }
};
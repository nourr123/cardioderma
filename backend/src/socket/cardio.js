// Temps réel : namespace /device (le Raspberry Pi) et /cardio (le navigateur du patient).
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const CardioDevice = require("../models/CardioDevice");
const CardioSession = require("../models/CardioSession");
const CardioMeasure = require("../models/CardioMeasure");

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const tableau = (a, max) => Array.isArray(a) && a.length <= max && a.every(fin);
const dans = (v, lo, hi) => fin(v) && v >= lo && v <= hi;
const texte = (s) => (typeof s === "string" ? s.slice(0, 200) : "");

const live = new Map(); // patientId -> { online, state, metrics }
let nsDevice = null;
let nsPatient = null;

const versPatient = (pid, evt, data) => nsPatient && nsPatient.to(`patient:${pid}`).emit(evt, data);

const isDeviceOnline = (pid) => !!(live.get(String(pid)) && live.get(String(pid)).online);

function notifySession(pid, session) {
  pid = String(pid);
  if (nsDevice) {
    nsDevice.to(`device:${pid}`).emit("session:sync", { sessionId: session ? String(session._id) : null });
  }
  versPatient(pid, "session:update", { session: session || null });
}

function disconnectDevice(pid) {
  if (nsDevice) nsDevice.in(`device:${String(pid)}`).disconnectSockets(true);
}

const mpuPropre = (m) =>
  m && typeof m === "object"
    ? {
        dispo: !!m.dispo,
        niveau: fin(m.niveau) ? m.niveau : 0,
        acc: tableau(m.acc, 3) ? m.acc : [0, 0, 0],
        gyro: tableau(m.gyro, 3) ? m.gyro : [0, 0, 0],
      }
    : null;

const metriquesPropres = (d) => ({
  valide: !!d.valide,
  bpm_ok: !!d.bpm_ok,
  message: texte(d.message),
  bpm: fin(d.bpm) ? d.bpm : null,
  rmssd: fin(d.rmssd) ? d.rmssd : null,
  sdnn: fin(d.sdnn) ? d.sdnn : null,
  pnn50: fin(d.pnn50) ? d.pnn50 : null,
  stress: fin(d.stress) ? d.stress : null,
  niveau: ["Faible", "Modéré", "Élevé"].includes(d.niveau) ? d.niveau : null,
  nb_battements: fin(d.nb_battements) ? d.nb_battements : 0,
  duree: fin(d.duree) ? d.duree : 0,
  mouvement: !!d.mouvement,
  mpu: mpuPropre(d.mpu),
});

function initCardio(io) {
  nsDevice = io.of("/device");
  nsPatient = io.of("/cardio");

  /* ---------- Raspberry Pi ---------- */
  nsDevice.use(async (socket, next) => {
    try {
      const cle = socket.handshake.auth && socket.handshake.auth.deviceKey;
      if (!cle) return next(new Error("unauthorized"));
      const dev = await CardioDevice.findOne({ keyHash: sha(cle) }).select("patient");
      if (!dev) return next(new Error("unauthorized"));
      socket.data.patientId = String(dev.patient);
      next();
    } catch {
      next(new Error("server"));
    }
  });

  nsDevice.on("connection", async (socket) => {
    const pid = socket.data.patientId;
    const room = `device:${pid}`;
    try {
      // un seul Pi par patient : le plus récent remplace l'ancien
      const anciens = await nsDevice.in(room).fetchSockets();
      anciens.forEach((s) => s.disconnect(true));
      socket.join(room);
      live.set(pid, { online: true, state: null, metrics: null });
      await CardioDevice.updateOne({ patient: pid }, { $set: { lastSeen: new Date() } });
      versPatient(pid, "device:status", { online: true });

      const active = await CardioSession.findOne({ patient: pid, status: "active" }).select("_id");
      socket.emit("session:sync", { sessionId: active ? String(active._id) : null });
    } catch (e) {
      console.error("[cardio] connexion Pi :", e.message);
    }

    socket.on("signal", (d) => {
      if (!d || !tableau(d.y, 4000) || !tableau(d.pics || [], 300) || !fin(d.fs)) return;
      versPatient(pid, "signal", { y: d.y, pics: d.pics || [], fs: d.fs });
    });

    socket.on("state", (d) => {
      if (!d || typeof d !== "object") return;
      const state = {
        signal_recu: !!d.signal_recu,
        electrodes_ok: !!d.electrodes_ok,
        mpu: !!d.mpu,
        simulation: !!d.simulation,
      };
      const l = live.get(pid);
      if (l) l.state = state;
      versPatient(pid, "device:state", state);
    });

    socket.on("metrics", (d) => {
      if (!d || typeof d !== "object") return;
      const m = metriquesPropres(d);
      const l = live.get(pid);
      if (l) l.metrics = m;
      versPatient(pid, "metrics", m);
    });

    socket.on("measure", async (d) => {
      try {
        if (!d || !mongoose.isValidObjectId(d.session_id)) return;
        const s = await CardioSession.findOne({ _id: d.session_id, patient: pid, status: "active" }).select("_id");
        if (!s) return;
        if (!dans(d.bpm, 20, 250) || !dans(d.stress, 0, 100) || !dans(d.rmssd, 0, 1000)) return;
        const doc = await CardioMeasure.create({
          session: s._id,
          patient: pid,
          at: new Date(),
          bpm: d.bpm,
          rmssd: d.rmssd,
          sdnn: fin(d.sdnn) ? d.sdnn : null,
          pnn50: fin(d.pnn50) ? d.pnn50 : null,
          stress: d.stress,
          level: ["Faible", "Modéré", "Élevé"].includes(d.niveau) ? d.niveau : null,
          beats: fin(d.nb_battements) ? d.nb_battements : null,
          movement: fin(d.mouvement) ? d.mouvement : null,
          ecg: tableau(d.ecg, 2500) ? d.ecg : [],
        });
        const { ecg, ...legere } = doc.toObject();
        versPatient(pid, "measure:saved", legere);
      } catch (e) {
        console.error("[cardio] mesure :", e.message);
      }
    });

    socket.on("disconnect", async () => {
      const restants = await nsDevice.in(room).fetchSockets();
      if (restants.length === 0) {
        live.delete(pid);
        versPatient(pid, "device:status", { online: false });
      }
    });
  });

  /* ---------- Navigateur du patient ---------- */
  nsPatient.use((socket, next) => {
    try {
      const p = jwt.verify(socket.handshake.auth && socket.handshake.auth.token, process.env.JWT_SECRET);
      const id = p.id || p._id || p.userId || p.sub;
      if (!id) throw new Error("no id");
      socket.data.patientId = String(id);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  nsPatient.on("connection", (socket) => {
    const pid = socket.data.patientId;
    socket.join(`patient:${pid}`);
    const l = live.get(pid);
    socket.emit("device:status", { online: !!(l && l.online) });
    if (l && l.state) socket.emit("device:state", l.state);
    if (l && l.metrics) socket.emit("metrics", l.metrics);
  });
}

module.exports = { initCardio, isDeviceOnline, notifySession, disconnectDevice };
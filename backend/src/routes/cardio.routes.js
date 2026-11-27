const express = require("express");
const { protect } = require("../middlewares/auth.middleware"); // ← ADAPTER (voir ci-dessous)
const c = require("../controllers/cardio.controller");

const router = express.Router();

router.post("/device/pair", c.pair); // appelé par le Raspberry Pi, protégé par le code d'appairage

router.use(protect);
router.get("/device", c.deviceStatus);
router.post("/device/pairing", c.createPairing);
router.delete("/device", c.removeDevice);

router.get("/session/active", c.activeSession);
router.post("/session/start", c.startSession);
router.post("/session/stop", c.stopSession);

router.get("/sessions", c.listSessions);
router.get("/sessions/:id", c.sessionDetail);
router.delete("/sessions/:id", c.deleteSession);
router.get("/measures/:id/ecg", c.measureEcg);

module.exports = router;
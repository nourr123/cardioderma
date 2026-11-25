const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/derma", require("./derma.routes"));
router.use("/consultations", require("./consultation.routes")); // ← AJOUTÉ
router.use("/doctor", require("./doctor.routes")); // ← AJOUTÉ (espace médecin)
router.use("/appointments", require("./appointment.routes")); // ← AJOUTÉ (rendez-vous)

module.exports = router;

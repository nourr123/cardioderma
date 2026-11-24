const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/derma", require("./derma.routes"));
router.use("/consultations", require("./consultation.routes")); // ← AJOUTÉ
router.use("/appointments", require("./appointment.routes")); // ← AJOUTÉ (rendez-vous)
router.use("/products", require("./products"));
router.use("/orders", require("./orders"));
module.exports = router;
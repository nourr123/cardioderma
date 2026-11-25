
const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/derma", require("./derma.routes"));
router.use("/consultations", require("./consultation.routes"));
router.use("/doctor", require("./doctor.routes"));
router.use("/appointments", require("./appointment.routes"));

router.use("/products", require("./products"));
router.use("/orders", require("./orders"));

module.exports = router;

const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/derma", require("./derma.routes"));   // ← AJOUTER

module.exports = router;
const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/derma", require("./derma.routes"));
router.use("/users", require("./user.routes"));

module.exports = router;
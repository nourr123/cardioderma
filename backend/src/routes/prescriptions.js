const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const ctrl = require("../controllers/prescriptionController");

const protect = auth.protect ?? auth.authenticate ?? auth.verifyToken ?? auth;

router.post("/", protect, ctrl.create);
router.get("/mine", protect, ctrl.mine);
router.get("/sent", protect, ctrl.sent);

module.exports = router;
const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const ctrl = require("../controllers/orderController");

const protect = auth.protect ?? auth.authenticate ?? auth.verifyToken ?? auth;

router.post("/checkout", protect, ctrl.checkout);
router.get("/confirm", protect, ctrl.confirm);

module.exports = router;
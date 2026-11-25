const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");
const uploadProductImage = require("../middlewares/uploadProductImage");
const ctrl = require("../controllers/productController");

// Adapte ces deux lignes aux exports réels de tes middlewares
const protect = auth.protect ?? auth.authenticate ?? auth.verifyToken ?? auth;
const adminOnly = role.adminOnly ?? role.requireRole?.("admin") ?? role.authorize?.("admin") ?? role;

router.get("/", protect, ctrl.getAll);
router.post("/", protect, adminOnly, uploadProductImage, ctrl.create);
router.put("/:id", protect, adminOnly, uploadProductImage, ctrl.update);
router.delete("/:id", protect, adminOnly, ctrl.remove);

module.exports = router;
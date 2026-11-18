const router = require("express").Router();
const { protect } = require("../middlewares/auth.middleware");
const { getMe, updateMe, changePassword } = require("../controllers/user.controller");

// Toutes les routes de ce fichier : utilisateur connecté
router.use(protect);

router.get("/me", getMe);
router.put("/me", updateMe);
router.put("/me/password", changePassword);

module.exports = router;
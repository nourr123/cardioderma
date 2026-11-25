const router = require("express").Router();
const service = require("../services/doctor.service");
const { protect } = require("../middlewares/auth.middleware");

// Le service vérifie que l'utilisateur est médecin et ne renvoie que ses propres données
router.use(protect);

router.get("/dashboard", async (req, res) => {
  res.json({ success: true, ...(await service.dashboard(req.user)) });
});

module.exports = router;

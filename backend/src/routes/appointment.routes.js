const router = require("express").Router();
const controller = require("../controllers/appointment.controller");
const { protect } = require("../middlewares/auth.middleware");

// Patient ou médecin connecté : le service vérifie qu'il fait partie du rendez-vous
router.use(protect);

router.get("/", controller.listMine); // mes rendez-vous (à venir + historique)
router.patch("/:id", controller.respond); // body : { action: "accept" | "decline" | "cancel" | "complete" }

module.exports = router;

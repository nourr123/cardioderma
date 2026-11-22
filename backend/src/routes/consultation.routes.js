const router = require("express").Router();
const controller = require("../controllers/consultation.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");

// Toutes les routes : utilisateur connecté
router.use(protect);

// Réservé aux patients
router.get("/medecins", authorize("patient"), controller.listMedecins);
router.post("/", authorize("patient"), controller.create);

// Patient ET médecin : le service vérifie que l'utilisateur fait partie de la conversation
router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.get("/:id/messages", controller.listMessages);
router.get("/:id/image", controller.getImage);
router.patch("/:id/read", controller.markRead);

module.exports = router;
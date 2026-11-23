const router = require("express").Router();
const controller = require("../controllers/consultation.controller");
const appointments = require("../controllers/appointment.controller");
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
// Dossier du patient (médecin de la conversation uniquement : contrôlé dans le service)
router.get("/:id/patient-history", controller.patientHistory);
router.get("/:id/patient-history/:analysisId/image", controller.patientAnalysisImage);

// Avis médical (médecin uniquement : contrôlé dans le service)
router.post("/:id/opinions", controller.postOpinion);

// Rendez-vous de la conversation
router.get("/:id/appointments", appointments.listForConversation);
router.post("/:id/appointments", appointments.create);
router.patch("/:id/read", controller.markRead);

module.exports = router;

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const jwt = require("jsonwebtoken");
const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Format non supporté (JPG, PNG ou WEBP)")),
});

const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Même dossier "uploads" que les justificatifs des médecins (admin.service), sous-dossier derma.
// Il n'est servi par aucune route publique : seules les routes protégées y accèdent.
const dermaDir = path.join(__dirname, "../../uploads", "derma");
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

router.post("/analyze", protect, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucune image reçue" });

  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const { data } = await axios.post(`${AI_URL}/predict`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    // Le modèle recommande une consultation ("Confiance faible : avis médical recommandé"
    // ou "Pathologie nécessitant un avis médical") : on délivre un jeton signé, valable
    // 30 min, qui autorise ce patient à ouvrir une conversation avec un médecin.
    // Sans ce jeton, impossible de contacter un médecin : le client ne peut pas le falsifier.
    console.log("[derma/analyze]", data.recommendation, "| jeton prévu :", data.recommendation === "consultation");
    if (data.recommendation === "consultation") {
      // La photo n'est conservée QUE dans ce cas : elle servira au médecin.
      // Nom généré par le serveur (jamais celui du client) : pas de traversée de dossier.
      const image = `${crypto.randomUUID()}.${EXT[req.file.mimetype]}`;
      try {
        await fs.promises.mkdir(dermaDir, { recursive: true });
        await fs.promises.writeFile(path.join(dermaDir, image), req.file.buffer);
      } catch (e) {
        console.error("Erreur enregistrement photo :", e);
        return res.status(500).json({ message: "Impossible d'enregistrer la photo pour le médecin" });
      }

      data.referralToken = jwt.sign(
        {
          type: "derma-referral",
          uid: String(req.user._id),
          prediction: data.prediction,
          confidence: data.confidence,
          reason: data.reason,
          image,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m", jwtid: crypto.randomUUID() }
      );
    }

    res.json(data);
  } catch (err) {
    const status = err.response?.status === 400 ? 400 : 502;
    res.status(status).json({
      message: err.response?.data?.detail || "Le service d'analyse est indisponible",
    });
  }
});

// Erreurs multer (taille, format) renvoyées en JSON propre
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith("Format")) {
    return res.status(400).json({
      message: err.code === "LIMIT_FILE_SIZE" ? "L'image dépasse 5 Mo" : err.message,
    });
  }
  next(err);
});

module.exports = router;
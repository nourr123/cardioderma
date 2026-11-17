const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { protect } = require("../middlewares/auth.middleware"); // ← adaptez le nom selon l'étape 1

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
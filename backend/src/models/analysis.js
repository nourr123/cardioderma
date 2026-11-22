const mongoose = require("mongoose");

// Chaque analyse de peau est conservée : c'est la base de l'historique du patient.
// La photo n'est gardée (fichier) que si l'IA a recommandé une consultation.
const analysisSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    prediction: { type: String, required: true },
    confidence: { type: Number, required: true },
    top3: [
      {
        _id: false,
        label: { type: String },
        prob: { type: Number },
      },
    ],
    recommendation: { type: String, enum: ["conseil", "consultation"], required: true },
    reason: { type: String },

    // Nom du fichier dans uploads/derma (uniquement si recommendation === "consultation")
    image: { type: String },
  },
  { timestamps: true }
);

analysisSchema.index({ patient: 1, createdAt: -1 });

module.exports = mongoose.model("Analysis", analysisSchema);

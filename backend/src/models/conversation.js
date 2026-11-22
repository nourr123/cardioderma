const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medecin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Résultat de l'IA qui a motivé l'orientation (copié depuis le jeton signé)
    analysis: {
      prediction: { type: String },
      confidence: { type: Number },
      reason: { type: String },
    },

    // Nom du fichier de la photo analysée (dossier uploads/derma), conservé avec la conversation
    image: { type: String },

    // Identifiant unique du jeton d'orientation : évite les doublons (double clic)
    referralId: { type: String, unique: true, sparse: true },

    lastMessage: {
      text: { type: String },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date },
    },

    // Messages non lus, par rôle
    unread: {
      patient: { type: Number, default: 0 },
      medecin: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ patient: 1, updatedAt: -1 });
conversationSchema.index({ medecin: 1, updatedAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
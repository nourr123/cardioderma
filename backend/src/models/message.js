const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // text        : message écrit par un participant
    // opinion     : avis médical du médecin (carte structurée)
    // appointment : carte de rendez-vous (l'état à jour vient du modèle Appointment)
    // system      : ligne d'information ("Dr X a confirmé le rendez-vous…")
    type: {
      type: String,
      enum: ["text", "opinion", "appointment", "system"],
      default: "text",
    },

    // Toujours renseigné : sert d'aperçu dans la liste des conversations
    text: { type: String, required: true, trim: true, maxlength: 2000 },

    opinion: {
      verdict: { type: String, enum: ["confirme", "nuance", "infirme"] },
      commentaire: { type: String, trim: true, maxlength: 2000 },
      recommandations: { type: String, trim: true, maxlength: 2000 },
    },

    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ conversation: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
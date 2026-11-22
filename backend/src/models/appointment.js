const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medecin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Qui a fait la proposition : l'AUTRE personne doit répondre
    proposedBy: { type: String, enum: ["patient", "medecin"], required: true },

    startsAt: { type: Date, required: true },
    durationMin: { type: Number, required: true },
    endsAt: { type: Date, required: true }, // startsAt + durationMin (sert aux contrôles de chevauchement)
    note: { type: String, trim: true, maxlength: 300 },

    // propose -> confirme | refuse | annule ;  confirme -> annule | termine
    status: {
      type: String,
      enum: ["propose", "confirme", "refuse", "annule", "termine"],
      default: "propose",
    },
    respondedAt: { type: Date },
    cancelledBy: { type: String, enum: ["patient", "medecin"] },
  },
  { timestamps: true }
);

appointmentSchema.index({ medecin: 1, startsAt: 1 });
appointmentSchema.index({ patient: 1, startsAt: 1 });
appointmentSchema.index({ conversation: 1, startsAt: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);

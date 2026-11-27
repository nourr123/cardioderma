const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  at: { type: Date, required: true },
  bpm: Number,
  rmssd: Number,
  sdnn: Number,
  pnn50: Number,
  stress: Number,
  level: { type: String, enum: ["Faible", "Modéré", "Élevé", null] },
  beats: Number,
  movement: Number,
  ecg: { type: [Number], default: [] },
});

schema.index({ session: 1, at: 1 });

module.exports = mongoose.models.CardioMeasure || mongoose.model("CardioMeasure", schema);
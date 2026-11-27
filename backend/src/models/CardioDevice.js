const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    keyHash: { type: String, index: true, sparse: true },
    pairingHash: { type: String },
    pairingExpires: { type: Date },
    lastSeen: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.CardioDevice || mongoose.model("CardioDevice", schema);
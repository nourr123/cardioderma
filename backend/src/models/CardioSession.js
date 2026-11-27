const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

schema.index({ patient: 1, startedAt: -1 });
schema.index({ patient: 1 }, { unique: true, partialFilterExpression: { status: "active" } });

module.exports = mongoose.models.CardioSession || mongoose.model("CardioSession", schema);
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true }, // copie du nom au moment de l'ordonnance
    quantity: { type: Number, required: true, min: 1, max: 99 },
    instructions: { type: String, trim: true, default: "" }, // posologie / conseil
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    items: {
      type: [itemSchema],
      validate: [(v) => v.length > 0, "Au moins un produit est requis"],
    },
    note: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.models.Prescription || mongoose.model("Prescription", prescriptionSchema);
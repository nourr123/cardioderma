const Prescription = require("../models/Prescription");
const Product = require("../models/Product");
const Conversation = require("../models/conversation");

const uid = (req) => String(req.user?._id || req.user?.id || "");
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj[k]) return obj[k];
  return null;
};

// POST /api/prescriptions
// body: { conversationId, note, items: [{ productId, quantity, instructions }] }
exports.create = async (req, res) => {
  try {
    const { conversationId, items, note } = req.body;

    if (!conversationId) return res.status(400).json({ message: "Choisissez un patient" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Ajoutez au moins un produit" });
    }

    // Le médecin ne peut écrire qu'à un patient de SES conversations
    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: "Patient introuvable" });

    const doctorId = pick(conv, "doctor", "medecin", "doctorId");
    const patientId = pick(conv, "patient", "patientId");
    if (!doctorId || !patientId) {
      console.error("[prescriptions] champs médecin/patient introuvables dans Conversation :", Object.keys(conv.toObject()));
      return res.status(500).json({ message: "Structure de la conversation non reconnue" });
    }
    if (String(doctorId) !== uid(req)) {
      return res.status(403).json({ message: "Ce patient n'est pas suivi par vous" });
    }

    const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } });
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const lines = [];
    for (const i of items) {
      const p = byId.get(String(i.productId));
      const qty = Math.floor(Number(i.quantity));
      if (!p) return res.status(400).json({ message: "Un produit sélectionné n'existe plus" });
      if (!qty || qty < 1 || qty > 99) {
        return res.status(400).json({ message: `Quantité invalide pour « ${p.name} »` });
      }
      lines.push({
        product: p._id,
        name: p.name,
        quantity: qty,
        instructions: String(i.instructions || "").slice(0, 300),
      });
    }

    const prescription = await Prescription.create({
      doctor: doctorId,
      patient: patientId,
      conversation: conv._id,
      items: lines,
      note: String(note || "").slice(0, 1000),
    });

    console.log(`[prescriptions] ordonnance ${prescription._id} créée (${lines.length} produit(s))`);
    res.status(201).json(prescription);
  } catch (e) {
    console.error("[prescriptions] erreur create :", e);
    res.status(e.name === "CastError" ? 400 : 500).json({ message: e.message });
  }
};

// GET /api/prescriptions/mine : ordonnances reçues par le patient connecté
exports.mine = async (req, res) => {
  try {
    const list = await Prescription.find({ patient: uid(req) })
      .sort({ createdAt: -1 })
      .populate("doctor", "prenom nom")
      .populate("items.product");
    res.json(list);
  } catch (e) {
    console.error("[prescriptions] erreur mine :", e);
    res.status(500).json({ message: e.message });
  }
};

// GET /api/prescriptions/sent : ordonnances envoyées par le médecin connecté
exports.sent = async (req, res) => {
  try {
    const list = await Prescription.find({ doctor: uid(req) })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("patient", "prenom nom");
    res.json(list);
  } catch (e) {
    console.error("[prescriptions] erreur sent :", e);
    res.status(500).json({ message: e.message });
  }
};
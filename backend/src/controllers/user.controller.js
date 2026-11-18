const User = require("../models/user");

let bcrypt;
try {
  bcrypt = require("bcryptjs");
} catch {
  bcrypt = require("bcrypt");
}

// Nom côté frontend -> noms possibles dans ton schéma (le premier trouvé est utilisé)
const FIELD_CANDIDATES = {
  firstName: ["firstName", "prenom", "first_name"],
  lastName: ["lastName", "nom", "last_name"],
  email: ["email"],
  phone: ["phone", "telephone", "tel", "numTel"],
};
const PASSWORD_CANDIDATES = ["password", "motDePasse", "mot_de_passe", "passwordHash", "motdepasse"];

const schemaPaths = Object.keys(User.schema.paths);
const resolveField = (key) => FIELD_CANDIDATES[key].find((f) => schemaPaths.includes(f));
const passwordField = PASSWORD_CANDIDATES.find((f) => schemaPaths.includes(f));

// Version de l'utilisateur renvoyée au frontend (sans mot de passe)
const toClient = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  [...PASSWORD_CANDIDATES, "__v"].forEach((k) => delete obj[k]);
  for (const key of Object.keys(FIELD_CANDIDATES)) {
    const field = resolveField(key);
    if (field && obj[field] !== undefined) obj[key] = obj[field];
  }
  return obj;
};

exports.getMe = async (req, res) => {
  res.json({ user: toClient(req.user) });
};

exports.updateMe = async (req, res) => {
  try {
    const id = req.user._id;

    // seuls ces 4 champs sont modifiables (jamais role, password, estActif...)
    const updates = {};
    for (const key of Object.keys(FIELD_CANDIDATES)) {
      const field = resolveField(key);
      if (field && typeof req.body[key] === "string") {
        updates[field] = req.body[key].trim();
      }
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      const taken = await User.findOne({ email: updates.email, _id: { $ne: id } });
      if (taken) {
        return res.status(409).json({ message: "Cet e-mail est déjà utilisé" });
      }
    }

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json({ user: toClient(user) });
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    if (!passwordField) {
      return res
        .status(500)
        .json({ message: "Champ mot de passe introuvable dans le modèle" });
    }

    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }
    if (newPassword === currentPassword) {
      return res
        .status(400)
        .json({ message: "Le nouveau mot de passe doit être différent de l'ancien" });
    }

    // on recharge l'utilisateur avec son hash (au cas où le champ est en select:false)
    const user = await User.findById(req.user._id).select(`+${passwordField}`);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    const ok = await bcrypt.compare(currentPassword, user[passwordField]);
    if (!ok) {
      return res.status(400).json({ message: "Mot de passe actuel incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    // updateOne : n'exécute pas les hooks pre("save"), donc pas de double hachage
    await User.updateOne({ _id: user._id }, { $set: { [passwordField]: hash } });

    res.json({ message: "Mot de passe mis à jour" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
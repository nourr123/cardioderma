const fs = require("fs");
const path = require("path");
const Product = require("../models/Product");

const removeImageFile = (imagePath) => {
  if (!imagePath || !imagePath.startsWith("/uploads/")) return;
  const fullPath = path.join(__dirname, "../..", imagePath);
  fs.unlink(fullPath, () => {}); // on ignore l'erreur si le fichier n'existe pas
};

exports.getAll = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

    if (!name || price === undefined || price === "") {
      if (req.file) removeImageFile(`/uploads/products/${req.file.filename}`);
      return res.status(400).json({ message: "Le nom et le prix sont obligatoires" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "L'image du produit est obligatoire" });
    }

    const product = await Product.create({
      name,
      description,
      price: Number(price),
      category,
      stock: Number(stock) || 0,
      image: `/uploads/products/${req.file.filename}`,
    });

    res.status(201).json(product);
  } catch (e) {
    if (req.file) removeImageFile(`/uploads/products/${req.file.filename}`);
    res.status(500).json({ message: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      if (req.file) removeImageFile(`/uploads/products/${req.file.filename}`);
      return res.status(404).json({ message: "Produit introuvable" });
    }

    const { name, description, price, category, stock } = req.body;
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined && price !== "") product.price = Number(price);
    if (category !== undefined) product.category = category;
    if (stock !== undefined && stock !== "") product.stock = Number(stock);

    if (req.file) {
      removeImageFile(product.image); // supprime l'ancienne image
      product.image = `/uploads/products/${req.file.filename}`;
    }

    await product.save();
    res.json(product);
  } catch (e) {
    if (req.file) removeImageFile(`/uploads/products/${req.file.filename}`);
    res.status(500).json({ message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    removeImageFile(product.image);
    res.json({ message: "Produit supprimé" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
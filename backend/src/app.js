const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const routes = require("./routes");
const orderCtrl = require("./controllers/orderController");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

// Dossier des images (backend/uploads/products)
const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(path.join(uploadsDir, "products"), { recursive: true });

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ⚠️ Webhook Stripe : corps BRUT, donc AVANT express.json()
app.post("/api/orders/webhook", express.raw({ type: "application/json" }), orderCtrl.webhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les images uploadées : http://localhost:5000/uploads/products/xxx.jpg
app.use("/uploads", express.static(uploadsDir));

// Route d'accueil
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to CardioDerma API!",
    status: "running",
  });
});

// Vérification de l'état de l'API
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    project: "CardioDerma",
  });
});

// Routes API
app.use("/api", routes);

// Toujours en dernier
app.use(notFound);
app.use(errorHandler);

module.exports = app;
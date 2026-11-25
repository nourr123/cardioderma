const Stripe = require("stripe");
const Product = require("../models/Product");
const Order = require("../models/Order");

let stripeClient;
const getStripe = () => {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquant dans le .env");
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 0 });
  }
  return stripeClient;
};

const CURRENCY = (process.env.STRIPE_CURRENCY || "eur").toLowerCase();
const TND_PER_UNIT = Number(process.env.TND_PER_UNIT) || 3.4;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// DT -> plus petite unité de la devise Stripe (centimes)
const toMinorUnit = (dt) => Math.max(1, Math.round((dt / TND_PER_UNIT) * 100));

// Passe la commande à "paid" puis décrémente le stock UNE SEULE FOIS.
// Appelée par le webhook ET par /confirm : sans risque de double traitement.
async function fulfillOrder(orderId) {
  // 1. Marque la commande comme payée (seulement si elle est encore "pending")
  const paidRes = await Order.updateOne(
    { _id: orderId, status: "pending" },
    { status: "paid", paidAt: new Date() }
  );
  console.log(`[orders] ${orderId} : passage à "paid" ->`, paidRes.modifiedCount ? "oui" : "déjà fait");

  // 2. Verrou atomique : un seul appel obtient la commande et décrémente le stock
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "paid", stockDeducted: { $ne: true } },
    { stockDeducted: true },
    { new: true }
  );

  if (!order) {
    console.log(`[orders] ${orderId} : stock déjà décrémenté (ou commande non payée), rien à faire`);
  } else {
    for (const item of order.items) {
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      console.log(
        `[orders] ${orderId} : stock de « ${item.name} » -${item.quantity} ->`,
        result.modifiedCount ? "OK" : "échec (stock insuffisant ou produit introuvable)"
      );
      // Stock insuffisant entre-temps : on le ramène à 0 au lieu d'une valeur négative
      if (result.modifiedCount === 0) {
        await Product.updateOne({ _id: item.product }, { $set: { stock: 0 } });
      }
    }
  }

  return Order.findById(orderId);
}

// POST /api/orders/checkout  body: { items: [{ id, qty }] }
exports.checkout = async (req, res) => {
  const t0 = Date.now();
  const elapsed = () => `${Date.now() - t0} ms`;
  console.log("[orders] checkout reçu");

  try {
    const userId = req.user?._id || req.user?.id;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Le panier est vide" });
    }

    const products = await Product.find({ _id: { $in: items.map((i) => i.id) } });
    console.log(`[orders] produits lus en base (${elapsed()})`);
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const orderItems = [];
    for (const i of items) {
      const p = byId.get(String(i.id));
      const qty = Math.floor(Number(i.qty));
      if (!p) return res.status(400).json({ message: "Un produit du panier n'existe plus" });
      if (!qty || qty < 1) return res.status(400).json({ message: `Quantité invalide pour ${p.name}` });
      if (p.stock < qty) {
        return res.status(400).json({
          message:
            p.stock > 0
              ? `Stock insuffisant pour « ${p.name} » (${p.stock} restant)`
              : `« ${p.name} » est en rupture de stock`,
        });
      }
      orderItems.push({ product: p._id, name: p.name, price: p.price, image: p.image, quantity: qty });
    }

    const total = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const order = await Order.create({ user: userId, items: orderItems, total });
    console.log(`[orders] commande ${order._id} créée, ${total} DT (${elapsed()})`);

    try {
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        line_items: orderItems.map((i) => ({
          quantity: i.quantity,
          price_data: {
            currency: CURRENCY,
            unit_amount: toMinorUnit(i.price),
            product_data: { name: i.name },
          },
        })),
        client_reference_id: String(order._id),
        metadata: { orderId: String(order._id) },
        success_url: `${CLIENT_URL}/commande/succes?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/panier?cancelled=1`,
      });
      console.log(`[orders] session Stripe créée (${elapsed()})`);

      order.stripeSessionId = session.id;
      await order.save();
      res.status(201).json({ url: session.url });
    } catch (err) {
      console.error(`[orders] Stripe a échoué (${elapsed()}) :`, err.type, "-", err.message);
      order.status = "cancelled";
      await order.save();

      const unreachable = err.type === "StripeConnectionError";
      return res.status(502).json({
        message: unreachable
          ? "Impossible de joindre Stripe depuis le serveur (problème de réseau). Réessayez."
          : err.message,
      });
    }
  } catch (e) {
    console.error(`[orders] erreur checkout (${elapsed()}) :`, e);
    res.status(500).json({ message: e.message });
  }
};

// GET /api/orders/confirm?session_id=...  (appelée par la page de succès)
exports.confirm = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ message: "session_id manquant" });

    const session = await getStripe().checkout.sessions.retrieve(session_id);
    const orderId = session.metadata?.orderId;
    console.log(`[orders] confirm : session ${session_id}, paiement = ${session.payment_status}, commande = ${orderId}`);

    const order = orderId && (await Order.findOne({ _id: orderId, user: userId }));
    if (!order) return res.status(404).json({ message: "Commande introuvable" });

    if (session.payment_status === "paid") {
      return res.json(await fulfillOrder(order._id));
    }
    res.json(order); // paiement pas encore confirmé
  } catch (e) {
    console.error("[orders] erreur confirm :", e);
    res.status(500).json({ message: e.message });
  }
};

// POST /api/orders/webhook  (corps brut, signature Stripe)
exports.webhook = async (req, res) => {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[orders] webhook signature invalide :", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (
      orderId &&
      (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
      session.payment_status === "paid"
    ) {
      await fulfillOrder(orderId);
    }

    if (orderId && event.type === "checkout.session.expired") {
      await Order.updateOne({ _id: orderId, status: "pending" }, { status: "cancelled" });
    }

    res.json({ received: true });
  } catch (e) {
    console.error("[orders] erreur webhook :", e);
    res.status(500).json({ message: e.message }); // Stripe réessaiera
  }
};
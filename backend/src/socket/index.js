const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const service = require("../services/consultation.service");
const { emitMessage } = require("../utils/realtime");

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Authentification : le même JWT que l'API REST
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Non authentifié"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || !user.estActif) return next(new Error("Compte indisponible"));
      if (user.role !== "patient" && user.role !== "medecin") {
        return next(new Error("Accès refusé"));
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error("Jeton invalide ou expiré"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    // Une "salle" par utilisateur : couvre plusieurs onglets / appareils
    socket.join(`user:${user._id}`);

    // --- Envoi d'un message ---------------------------------------------------
    socket.on("message:send", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const { conversationId, text } = payload || {};
        const result = await service.postMessage(user, conversationId, text);

        emitMessage(io, result);

        reply({ ok: true, message: result.message });
      } catch (err) {
        reply({ ok: false, error: err.message || "Envoi impossible" });
      }
    });

    // --- Messages lus ----------------------------------------------------------
    socket.on("conversation:read", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const { otherUserId } = await service.markRead(user, payload?.conversationId);
        io.to(`user:${otherUserId}`).emit("conversation:read", {
          conversationId: payload.conversationId,
        });
        reply({ ok: true });
      } catch (err) {
        reply({ ok: false, error: err.message });
      }
    });

    // --- "Est en train d'écrire…" ---------------------------------------------
    socket.on("typing", async (payload) => {
      try {
        const otherId = await service.getOtherParticipantId(user, payload?.conversationId);
        if (!otherId) return;
        io.to(`user:${otherId}`).emit("typing", {
          conversationId: payload.conversationId,
          typing: Boolean(payload.typing),
        });
      } catch {
        /* ignoré : ce n'est qu'un indicateur */
      }
    });
  });

  return io;
};

module.exports = { initSocket };
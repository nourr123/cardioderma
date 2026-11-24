const callService = require("../services/call.service");

const MAX_SIGNAL_BYTES = 32 * 1024; // une offre SDP fait quelques Ko
const roomOf = (appointmentId) => `call:${appointmentId}`;

// Signalisation WebRTC : le serveur ne fait que mettre les deux personnes en relation
// et relayer offre / réponse / candidats ICE. La vidéo passe directement entre navigateurs.
const registerCall = (io, socket) => {
  const user = socket.data.user;
  const myId = String(user._id);

  const leaveAll = () => {
    for (const room of [...socket.rooms]) {
      if (room.startsWith("call:")) {
        socket.leave(room);
        socket.to(room).emit("call:peer-left");
      }
    }
  };

  socket.on("call:join", async (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const appointmentId = String(payload?.appointmentId ?? "");
      const access = await callService.getCallAccess(user, appointmentId);
      const room = roomOf(appointmentId);

      // Une seule connexion par personne : un autre onglet / appareil est remplacé
      const sockets = await io.in(room).fetchSockets();
      for (const s of sockets) {
        if (s.id !== socket.id && String(s.data.user._id) === myId) {
          s.emit("call:replaced");
          s.leave(room);
        }
      }

      // On quitte une éventuelle autre salle (une seule consultation à la fois)
      for (const r of [...socket.rooms]) {
        if (r.startsWith("call:") && r !== room) {
          socket.leave(r);
          socket.to(r).emit("call:peer-left");
        }
      }

      const already = socket.rooms.has(room);
      const peerPresent = sockets.some((s) => s.id !== socket.id && String(s.data.user._id) !== myId);

      socket.join(room);
      if (!already) socket.to(room).emit("call:peer-joined");

      reply({
        ok: true,
        peerPresent,
        iceServers: callService.iceServers(),
        role: access.role,
        peer: access.peer,
        appointment: access.appointment,
      });
    } catch (err) {
      reply({ ok: false, error: err.message || "Impossible de rejoindre la consultation" });
    }
  });

  socket.on("call:signal", (payload) => {
    const room = roomOf(String(payload?.appointmentId ?? ""));
    if (!socket.rooms.has(room)) return; // il faut avoir rejoint la salle (donc passé la vérification)

    const data = payload?.data;
    if (!data || typeof data !== "object") return;
    const kind = data.sdp ? "sdp" : data.candidate !== undefined ? "candidate" : null;
    if (!kind) return;
    if (JSON.stringify(data).length > MAX_SIGNAL_BYTES) return;

    socket.to(room).emit("call:signal", { data });
  });

  socket.on("call:leave", leaveAll);
  socket.on("disconnecting", leaveAll);
};

module.exports = { registerCall };

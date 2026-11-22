// Diffusion temps réel (Socket.IO) : chaque utilisateur a sa "salle" user:<id>.
// Utilisé par le socket ET par les controllers REST (avis, rendez-vous).

const room = (id) => `user:${id}`;

// result : retour de consultation.service.createMessage / postMessage
const emitMessage = (io, result) => {
  if (!io || !result) return;
  io.to(room(result.patientId)).emit("message:new", {
    message: result.message,
    conversation: result.forPatient,
  });
  io.to(room(result.medecinId)).emit("message:new", {
    message: result.message,
    conversation: result.forMedecin,
  });
};

// appointment : rendez-vous sérialisé (patient.id et medecin.id présents)
const emitAppointment = (io, appointment) => {
  if (!io || !appointment) return;
  io.to(room(appointment.patient.id)).emit("appointment:update", { appointment });
  io.to(room(appointment.medecin.id)).emit("appointment:update", { appointment });
};

module.exports = { emitMessage, emitAppointment };

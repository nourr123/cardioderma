const service = require("../services/appointment.service");
const { emitAppointment, emitMessage } = require("../utils/realtime");

// Diffuse en direct : la carte de rendez-vous ET le message qui l'accompagne
const broadcast = (req, { appointment, payload }) => {
  const io = req.app.get("io");
  emitAppointment(io, appointment);
  emitMessage(io, payload);
};

const create = async (req, res) => {
  const result = await service.create(req.user, req.params.id, req.body);
  broadcast(req, result);
  res.status(201).json({
    success: true,
    appointment: result.appointment,
    message: result.payload.message,
  });
};

const respond = async (req, res) => {
  const result = await service.respond(req.user, req.params.id, req.body?.action);
  broadcast(req, result);
  res.json({
    success: true,
    appointment: result.appointment,
    message: result.payload.message,
  });
};

const listForConversation = async (req, res) => {
  const appointments = await service.listForConversation(req.user, req.params.id);
  res.json({ success: true, appointments });
};

const listMine = async (req, res) => {
  const data = await service.listMine(req.user);
  res.json({ success: true, ...data });
};

module.exports = { create, respond, listForConversation, listMine };

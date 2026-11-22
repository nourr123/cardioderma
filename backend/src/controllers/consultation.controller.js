const service = require("../services/consultation.service");
const { emitMessage } = require("../utils/realtime");

const listMedecins = async (req, res) => {
  const medecins = await service.listMedecins();
  res.json({ success: true, medecins });
};

const create = async (req, res) => {
  const { conversation: conv, created } = await service.createConversation(req.user, req.body);

  // Notifications uniquement pour une NOUVELLE conversation (pas en cas de double clic)
  if (created) {
    // Temps réel : la conversation apparaît dans la liste du médecin
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${String(conv.medecin._id)}`).emit("conversation:new", {
        conversation: service.serializeConversation(conv, "medecin"),
      });
    }

    // Email : en arrière-plan, la réponse au patient n'attend pas l'envoi
    service.notifyNewConversation(conv);
  }

  res.status(created ? 201 : 200).json({
    success: true,
    conversation: service.serializeConversation(conv, "patient"),
  });
};

const getImage = async (req, res) => {
  const filePath = await service.getImagePath(req.user, req.params.id);
  res.set("Cache-Control", "private, no-store");
  res.sendFile(filePath);
};

const list = async (req, res) => {
  const conversations = await service.listConversations(req.user);
  res.json({ success: true, conversations });
};

const getOne = async (req, res) => {
  const conversation = await service.getConversation(req.user, req.params.id);
  res.json({ success: true, conversation });
};

const listMessages = async (req, res) => {
  const messages = await service.listMessages(req.user, req.params.id, {
    before: req.query.before,
  });
  res.json({ success: true, messages });
};

// Avis médical du médecin : diffusé en direct au patient ET renvoyé au médecin
const postOpinion = async (req, res) => {
  const result = await service.postOpinion(req.user, req.params.id, req.body);
  emitMessage(req.app.get("io"), result);
  res.status(201).json({ success: true, message: result.message });
};

const markRead = async (req, res) => {
  await service.markRead(req.user, req.params.id);
  res.json({ success: true });
};

module.exports = { listMedecins, create, getImage, list, getOne, listMessages, postOpinion, markRead };
const sessionManager = require("../../services/sessionsManager");

// Cria grupo
const createGroup = async (instanceName, groupName, participants) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const group = await session.client.createGroup(
    groupName,
    participants.map((n) => `${n}@c.us`)
  );
  return group;
};

// Adiciona membros a um grupo
const addParticipantsToGroup = async (instanceName, groupId, participants) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const chat = await session.client.getChatById(groupId);
  await chat.addParticipants(participants.map((n) => `${n}@c.us`));
};

// Envia mensagem no grupo
const sendMessageToGroup = async (instanceName, groupId, text) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const chat = await session.client.getChatById(groupId);
  await chat.sendMessage(text);
};

module.exports = {
  createGroup,
  addParticipantsToGroup,
  sendMessageToGroup,
};

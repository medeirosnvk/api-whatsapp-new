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

const listAllGroups = async (instanceName) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const chats = await session.client.getChats();

  const groups = chats
    .filter((chat) => chat.isGroup)
    .map((group) => ({
      id: group.id._serialized,
      name: group.name,
      participantsCount: group.participants?.length || 0,
    }));

  return groups;
};

// Adiciona membros a um grupo
const addParticipantsToGroup = async (instanceName, groupId, participants) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${instanceName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${instanceName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  let chat;

  try {
    chat = await session.client.getChatById(groupId);
  } catch (error) {
    // fallback: tenta localizar o grupo em todos os chats
    const chats = await session.client.getChats();
    console.log("Grupos existentes- ", chats);

    chat = chats.find((c) => c.isGroup && c.id._serialized === groupId);
  }

  if (!chat || !chat.isGroup) {
    throw new Error("O ID fornecido não pertence a um grupo ou não foi encontrado.");
  }

  await chat.addParticipants(
    participants.map((n) => `${n}@c.us`),
    { autoSendInviteV4: true }
  );
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

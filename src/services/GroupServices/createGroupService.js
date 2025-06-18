const sessionManager = require("../../services/sessionsManager");
const { salvarGrupoEmCache, buscarGruposEmCache, buscarGruposEmCacheId } = require("./groupCacheFs");

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

  await salvarGrupoEmCache({ instanceName, groupId: group.gid._serialized, nome: groupName });

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

  // const groups = await session.client.getgroups();
  // const groups = groups
  //   .filter((group) => group.isGroup)
  //   .map((group) => ({
  //     id: group.id._serialized,
  //     name: group.name,
  //     participantsCount: group.participants?.length || 0,
  //   }));

  const localGrupos = await buscarGruposEmCache(instanceName);

  return localGrupos;
};

const addParticipantsToGroup = async (instanceName, groupId, participants) => {
  const session = sessionManager.getSession(instanceName);

  if (!session?.client) {
    throw new Error(`Sessão ${instanceName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${instanceName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const group = await session.client.getChatById(groupId);

  // Filtra números válidos e formata
  const validParticipants = participants
    .filter((n) => /^\d{10,15}$/.test(n)) // número com DDI e DDD
    .map((n) => `${n}@c.us`);

  if (validParticipants.length === 0) {
    throw new Error("Nenhum número válido para adicionar.");
  }

  try {
    await group.addParticipants(validParticipants, { autoSendInviteV4: true });
    console.log(`Participantes adicionados ao grupo ${groupId}:`, validParticipants);
  } catch (err) {
    console.error("Erro ao adicionar participantes:", err);
    throw new Error("Falha ao adicionar participantes: " + err.message);
  }
};

const sendMessageToGroup = async (instanceName, groupId, text) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const group = await session.client.getChatById(groupId);
  console.log("sendMessageToGroup group getChatById -", group);

  await group.sendMessage(text);
};

module.exports = {
  createGroup,
  listAllGroups,
  addParticipantsToGroup,
  sendMessageToGroup,
};

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

  let group;

  try {
    group = await session.client.getChatById(groupId);
  } catch (error) {
    console.warn(`Falha ao obter grupo diretamente: ${error.message}`);
    const cachedGroups = await buscarGruposEmCacheId(groupId);
    console.log(
      "Grupos em cache localizados -",
      cachedGroups.map((g) => g.id._serialized)
    );

    group = cachedGroups.find((c) => c.isGroup && c.id._serialized === groupId);
  }

  if (!group || !group.isGroup) {
    throw new Error("O ID fornecido não pertence a um grupo ou o grupo não foi encontrado.");
  }

  // Verifica se o usuário logado é admin do grupo
  const isAdmin = group.participants.some((p) => p.id.user === session.client.info.wid.user && (p.isAdmin || p.isSuperAdmin));

  if (!isAdmin) {
    throw new Error("A sessão atual não é administradora do grupo.");
  }

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
  await group.sendMessage(text);
};

module.exports = {
  createGroup,
  listAllGroups,
  addParticipantsToGroup,
  sendMessageToGroup,
};

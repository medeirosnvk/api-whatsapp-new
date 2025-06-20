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
    console.log("Tentando buscar grupo com getChatById:", groupId);

    group = await session.client.getChatById(groupId);
  } catch (error) {
    console.warn("getChatById falhou:", error.message);
  }

  if (!group || !group.isGroup) {
    console.log("Tentando buscar grupo via lista de chats...");

    const allChats = await session.client.getChats();
    group = allChats.find((chat) => chat.isGroup && chat.id._serialized === groupId);
  }

  if (!group || !group.isGroup) {
    throw new Error("Grupo não encontrado ou ID inválido.");
  }

  const groupName = group.name;
  const groupParticipants = group.participants;
  console.log("Nome do Grupo:", groupName);
  console.log("Participantes do Grupo:", groupParticipants);

  const isAdmin = group.participants?.some((p) => p.id.user === session.client.info.wid.user && (p.isAdmin || p.isSuperAdmin));

  if (!isAdmin) {
    throw new Error("A sessão atual não é administradora do grupo.");
  }

  const formattedParticipants = participants.filter((n) => /^\d{10,15}$/.test(n)).map((n) => `${n}@c.us`);

  if (formattedParticipants.length === 0) {
    throw new Error("Nenhum número válido foi fornecido.");
  }

  try {
    const result = await group.addParticipants(formattedParticipants, {
      comment: "Você foi convidado para o grupo!",
      autoSendInviteV4: true,
      sleep: [200, 400],
    });

    const resultadoDetalhado = Object.entries(result).map(([id, info]) => ({
      participante: id,
      codigo: info.code,
      mensagem: info.message,
      conviteEnviado: info.isInviteV4Sent || false,
    }));

    console.table(resultadoDetalhado);
    return resultadoDetalhado;
  } catch (err) {
    console.error("Erro ao tentar adicionar participantes:", err);
    throw new Error("Erro ao adicionar participantes: " + err.message);
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

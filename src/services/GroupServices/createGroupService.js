const sessionManager = require("../../services/sessionsManager");
const { salvarGrupoEmCache, buscarGruposEmCache, buscarGruposEmCacheId } = require("./groupCacheFs");

const formatNumberToWid = (number) => {
  const cleaned = number.replace(/\D/g, ""); // remove tudo que não é número
  if (!cleaned.startsWith("55")) {
    throw new Error("Número precisa estar no formato DDI + DDD + número. Ex: 5598999999999");
  }
  return `${cleaned}@c.us`;
};

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

  const chats = await session.client.getChats();
  const group = chats.find((chat) => chat.id._serialized === groupId && chat.isGroup === true);

  console.log("Grupo encontrado:", group?.name || "não encontrado");
  console.log("Tipo de chat:", group?.constructor?.name);

  if (!group || typeof group.addParticipants !== "function") {
    throw new Error("Grupo não encontrado ou método addParticipants não disponível.");
  }

  // ✅ Limpeza e validação dos números
  const formatToWid = (number) => {
    try {
      const cleaned = number?.toString().replace(/\D/g, "");
      if (!cleaned || cleaned.length < 10 || !cleaned.startsWith("55")) return null;
      return `${cleaned}@c.us`;
    } catch {
      return null;
    }
  };

  const formattedParticipants = participants.map(formatToWid).filter(Boolean); // Remove inválidos ou nulos

  if (formattedParticipants.length === 0) {
    throw new Error("Nenhum número válido para adicionar ao grupo.");
  }

  try {
    const result = await group.addParticipants(formattedParticipants, {
      comment: "Você foi convidado para o grupo!",
      autoSendInviteV4: true,
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

const sessionManager = require("../../services/sessionsManager");
const { salvarGrupoEmCache, buscarGruposEmCache, buscarGruposEmCacheId } = require("./groupCacheFs");

const createGroup = async (instanceName, groupName, participants) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${instanceName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${instanceName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const groupInfo = await session.client.createGroup(
    groupName,
    participants.map((n) => `${n}@c.us`)
  );

  console.log("groupInfo -", groupInfo);

  const groupId = groupInfo.gid._serialized;
  await salvarGrupoEmCache({ instanceName, groupId, nome: groupName });

  // Força uma mensagem no grupo para que ele apareça no getChats()
  try {
    await session.client.sendMessage(groupId, "Grupo criado com sucesso!");
  } catch (e) {
    console.warn("Falha ao enviar mensagem de forçar sincronização:", e.message);
  }

  // Aguarda a sincronização do grupo como GroupChat
  let groupChat = null;
  const maxTentativas = 10;
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const chats = await session.client.getChats();
    groupChat = chats.find((chat) => chat.id._serialized === groupId && chat.isGroup === true);

    if (groupChat && typeof groupChat.sendMessage === "function") {
      console.log(`Grupo ${groupName} carregado com sucesso após ${tentativa + 1} tentativas.`);
      break;
    }

    console.log(`Aguardando grupo ${groupName} ficar disponível como GroupChat (${tentativa + 1}/${maxTentativas})...`);
    await new Promise((res) => setTimeout(res, 1000));
  }

  if (!groupChat) {
    throw new Error(`Grupo ${groupName} criado, mas não foi possível carregá-lo como GroupChat.`);
  }

  return groupChat;
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
  const participantsToAdd = ["5551991766192@c.us"];

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const group = await session.client.getChatById(groupId);
  console.log("sendMessageToGroup group getChatById -", group);

  try {
    const result = await group.addParticipants(participantsToAdd, {
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

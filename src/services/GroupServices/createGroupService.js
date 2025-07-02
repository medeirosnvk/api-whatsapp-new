const sessionManager = require("../../services/sessionsManager");
const { MessageMedia } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

function formatToWid(number) {
  try {
    if (typeof number !== "string" && typeof number !== "number") return null;

    const cleaned = number.toString().replace(/\D/g, "");
    if (!cleaned || cleaned.length < 12 || !cleaned.startsWith("55")) return null;

    const ddd = cleaned.slice(2, 4);
    let celular = cleaned.slice(4);

    if (celular.length === 9 && celular.startsWith("9")) {
      celular = celular.slice(1);
    }

    const numeroFinal = `55${ddd}${celular}`;
    return `${numeroFinal}@c.us`;
  } catch {
    return null;
  }
}

const createGroup = async (instanceName, groupName, participants, description, image) => {
  const session = sessionManager.getSession(instanceName);

  if (!session?.client) {
    throw new Error(`Sessão ${instanceName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${instanceName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const formattedParticipants = participants.map(formatToWid).filter(Boolean);

  if (formattedParticipants.length === 0) {
    throw new Error("Nenhum número válido para criar o grupo.");
  }

  const imagePath = path.join("public", image);

  try {
    const group = await session.client.createGroup(groupName, formattedParticipants);
    // const chat = await session.client.getChatById(group.gid._serialized);

    // if (description) {
    //   await chat.setDescription(description);
    // }

    // if (fs.existsSync(imagePath)) {
    //   const imageBuffer = fs.readFileSync(imagePath);
    //   const base64Data = imageBuffer.toString("base64");
    //   const ext = path.extname(imagePath).toLowerCase().replace(".", "");
    //   const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    //   const media = new MessageMedia(mimeType, base64Data, `group-image.${ext}`);

    //   const success = await chat.setPicture(media);
    //   console.log("Foto do grupo atualizada?", success);
    // }

    return group;
  } catch (error) {
    console.error("Erro ao tentar criar grupo:", error);
    throw new Error(`Erro ao criar o grupo: ${error.message}`);
  }
};

const listAllGroups = async (instanceName) => {
  const session = sessionManager.getSession(instanceName);

  if (!session.client) {
    throw new Error(`Sessão ${instanceName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${instanceName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const chats = await session.client.getChats();

  // Filtra somente os grupos
  const grupos = chats
    .filter((chat) => chat.isGroup === true)
    .map((group) => ({
      id: group.id._serialized,
      nome: group.name,
      participantes: group.participants?.map((p) => p.id._serialized) || [],
    }));

  return grupos;
};

const addParticipantsToGroup = async (instanceName, groupId, participants) => {
  const session = sessionManager.getSession(instanceName);

  if (!session?.client) {
    throw new Error(`Sessão ${instanceName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${instanceName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const groupById = await session.client.getChatById(groupId);

  if (!groupById || typeof groupById.addParticipants !== "function") {
    throw new Error("Grupo não encontrado ou método addParticipants não disponível.");
  }

  const formattedParticipants = [];

  for (const num of participants) {
    const wid = formatToWid(num);

    if (!wid) {
      console.warn("Número inválido:", num);
      continue;
    }

    const isRegistered = await session.client.isRegisteredUser(wid);

    if (!isRegistered) {
      console.warn("Usuário não está no WhatsApp:", wid);
      continue;
    }

    formattedParticipants.push(wid);
  }

  if (formattedParticipants.length === 0) {
    throw new Error("Nenhum participante válido e registrado para adicionar ao grupo.");
  }

  try {
    const result = await groupById.addParticipants(formattedParticipants, {
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

  await group.sendMessage(text);
};

module.exports = {
  createGroup,
  listAllGroups,
  addParticipantsToGroup,
  sendMessageToGroup,
};

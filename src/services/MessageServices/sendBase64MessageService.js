const sessionManager = require("../sessionsManager");
const { MessageMedia } = require("whatsapp-web.js");

const sendBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  let processedNumber = phoneNumber;
  const brazilCountryCode = "55";

  if (processedNumber.startsWith(brazilCountryCode)) {
    const localNumber = processedNumber.slice(4);

    if (localNumber.length === 9 && localNumber.startsWith("9")) {
      processedNumber = brazilCountryCode + processedNumber.slice(2, 4) + localNumber.slice(1);
    }
  }

  const { base64, fileName, caption, mimeType } = message;

  const messageMedia = new MessageMedia(mimeType, base64, fileName);

  await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
    caption: caption,
  });

  console.log(`Mensagem de mídia Base64 enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`);
};

const sendAudioBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  let processedNumber = phoneNumber;
  const brazilCountryCode = "55";

  // Ajuste do número brasileiro
  if (processedNumber.startsWith(brazilCountryCode)) {
    const localNumber = processedNumber.slice(4);

    if (localNumber.length === 9 && localNumber.startsWith("9")) {
      processedNumber = brazilCountryCode + processedNumber.slice(2, 4) + localNumber.slice(1);
    }
  }

  let { base64, fileName, caption, mimeType } = message;

  // Verificar e ajustar Base64
  if (base64.includes(",")) {
    base64 = base64.split(",")[1]; // Remove prefixo 'data:<mime>;base64,'
  }

  // Validar e ajustar MIME Type para áudio
  const supportedMimeTypes = ["audio/webm", "audio/ogg", "audio/mp3"];
  if (!supportedMimeTypes.includes(mimeType)) {
    console.warn(`MIME type ${mimeType} não é suportado. Alterando para audio/webm.`);
    mimeType = "audio/webm"; // Alterar para um MIME padrão suportado
  }

  // Criando o objeto de mídia com o MIME type adequado
  try {
    const messageMedia = new MessageMedia(mimeType, base64, fileName);

    // Enviando mensagem
    await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log(`Mensagem de áudio Base64 enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`);
  } catch (error) {
    console.error(`Erro ao enviar mensagem para o número ${phoneNumber}:`, error);
    throw new Error(`Falha ao enviar mensagem para o número ${phoneNumber}. Detalhes: ${error.message}`);
  }
};

module.exports = { sendBase64Message, sendAudioBase64Message };

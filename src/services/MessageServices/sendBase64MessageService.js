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

  if (processedNumber.startsWith(brazilCountryCode)) {
    const localNumber = processedNumber.slice(4);

    if (localNumber.length === 9 && localNumber.startsWith("9")) {
      processedNumber = brazilCountryCode + processedNumber.slice(2, 4) + localNumber.slice(1);
    }
  }

  const { base64, fileName, caption, mimeType } = message;

  // Criando o objeto de mídia com o MIME type adequado
  const messageMedia = new MessageMedia(mimeType, base64, fileName);

  await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
    caption: caption,
  });

  console.log(`Mensagem de áudio Base64 enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`);
};

module.exports = { sendBase64Message, sendAudioBase64Message };

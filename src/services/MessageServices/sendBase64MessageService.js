const sessionManager = require("../sessionsManager");
const { MessageMedia } = require("whatsapp-web.js");

const validateAndFormatNumber = async (client, rawNumber) => {
  const number = rawNumber.replace(/\D/g, ""); // remove tudo que não for número

  if (!number.startsWith("55") || number.length < 12 || number.length > 13) {
    throw new Error(`Número ${rawNumber} inválido. Deve estar no formato internacional começando com 55.`);
  }

  const jid = `${number}@c.us`;

  const isRegistered = await client.isRegisteredUser(jid);
  if (!isRegistered) {
    throw new Error(`O número ${number} não está registrado no WhatsApp.`);
  }

  return jid;
};

const sendBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const jid = await validateAndFormatNumber(session.client, phoneNumber);

  const { base64, fileName, caption, mimeType } = message;
  const messageMedia = new MessageMedia(mimeType, base64, fileName);

  try {
    await session.client.sendMessage(jid, messageMedia, { caption });
    console.log(
      `Mensagem de mídia Base64 enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`
    );
  } catch (error) {
    console.error(`Erro ao enviar mensagem Base64: ${error.message}`);
    throw new Error(`Erro ao enviar mensagem Base64: ${error.message}`);
  }
};

const sendAudioBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const jid = await validateAndFormatNumber(session.client, phoneNumber);

  let { base64, fileName, caption } = message;

  if (base64.includes(",")) {
    base64 = base64.split(",")[1]; // Remove prefixo 'data:<mime>;base64,'
  }

  const mimeTypesToTest = [
    "audio/webm",
    "audio/ogg",
    "audio/mp3",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/aac",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
  ];

  for (let mimeType of mimeTypesToTest) {
    try {
      console.log(`Enviando mensagem com MIME type: ${mimeType}`);

      const messageMedia = new MessageMedia(mimeType, base64, fileName);

      await session.client.sendMessage(jid, messageMedia, { caption });

      console.log(
        `Mensagem de ${mimeType} enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`
      );
      break; // Sucesso, para o loop
    } catch (error) {
      console.error(`Erro ao enviar mensagem com MIME type ${mimeType} para o número ${phoneNumber}:`, error.message);
    }
  }
};

module.exports = { sendBase64Message, sendAudioBase64Message };

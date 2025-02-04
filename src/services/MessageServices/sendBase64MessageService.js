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

  let { base64, fileName, caption } = message;

  if (base64.includes(",")) {
    base64 = base64.split(",")[1]; // Remove prefixo 'data:<mime>;base64,'
  }

  const mimeTypesToTest = [
    "audio/webm", // WebM Audio
    "audio/ogg", // Ogg Audio
    "audio/mp3", // MP3 Audio
    "audio/mpeg", // MPEG Audio
    "audio/wav", // WAV Audio
    "audio/x-wav", // WAV Audio (alternativo)
    "audio/flac", // FLAC Audio
    "audio/aac", // AAC Audio
    "image/jpeg", // JPEG Image
    "image/png", // PNG Image
    "image/gif", // GIF Image
    "image/webp", // WebP Image
    "video/mp4", // MP4 Video
    "video/webm", // WebM Video
  ];

  for (let mimeType of mimeTypesToTest) {
    try {
      console.log(`Enviando mensagem com MIME type: ${mimeType}`);

      const messageMedia = new MessageMedia(mimeType, base64, fileName);

      await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
        caption: caption,
      });

      console.log(`Mensagem de ${mimeType} enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`);
    } catch (error) {
      console.error(`Erro ao enviar mensagem com MIME type ${mimeType} para o número ${phoneNumber}:`, error);
    }
  }
};

module.exports = { sendBase64Message, sendAudioBase64Message };

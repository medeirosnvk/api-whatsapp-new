const sessionManager = require("../../services/sessionsManager");
const axios = require("axios");
const { MessageMedia } = require("whatsapp-web.js");

const sendMediaMessage = async (sessionName, phoneNumber, message) => {
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

  const { media, fileName, caption } = message;

  // Obter o arquivo de mídia
  const response = await axios.get(media, { responseType: "arraybuffer" }).catch((error) => {
    if (error.response && error.response.status === 404) {
      console.error(`Mídia não encontrada na URL fornecido: ${media}`);
      throw new Error(`Mídia não encontrada na URL fornecido: ${media}`);
    } else {
      console.error(`Erro ao obter a mídia: ${error.message}`);
      throw new Error(`Erro ao obter a mídia: ${error.message}`);
    }
  });

  if (!response) throw new Error(`Erro ao obter response media.`);

  const mimeType = response.headers["content-type"];
  const mediaData = Buffer.from(response.data, "binary").toString("base64");

  const messageMedia = new MessageMedia(mimeType, mediaData, fileName);

  await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
    caption: caption,
  });

  console.log(`Mensagem de media enviada com sucesso ao numero ${phoneNumber} pela instancia ${sessionName} no horário ${new Date()}!`);
};

module.exports = { sendMediaMessage };

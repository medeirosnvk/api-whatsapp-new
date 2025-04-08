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

  // Formatar número
  const formattedNumber = phoneNumber.replace(/\D/g, ""); // remove tudo que não for número

  if (!formattedNumber.startsWith("55") || formattedNumber.length < 12 || formattedNumber.length > 13) {
    throw new Error(`Número ${phoneNumber} inválido. Deve estar no formato internacional começando com 55.`);
  }

  const jid = `${formattedNumber}@c.us`;

  // Verificar se o número está registrado no WhatsApp
  const isRegistered = await session.client.isRegisteredUser(jid);
  if (!isRegistered) {
    throw new Error(`O número ${formattedNumber} não está registrado no WhatsApp.`);
  }

  const { media, fileName, caption } = message;

  // Obter o arquivo de mídia
  let response;

  try {
    response = await axios.get(media, { responseType: "arraybuffer" });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Mídia não encontrada na URL fornecida: ${media}`);
      throw new Error(`Mídia não encontrada na URL fornecida: ${media}`);
    } else {
      console.error(`Erro ao obter a mídia: ${error.message}`);
      throw new Error(`Erro ao obter a mídia: ${error.message}`);
    }
  }

  if (!response) throw new Error(`Erro ao obter resposta da mídia.`);

  const mimeType = response.headers["content-type"];
  const mediaData = Buffer.from(response.data, "binary").toString("base64");

  const messageMedia = new MessageMedia(mimeType, mediaData, fileName);

  try {
    await session.client.sendMessage(jid, messageMedia, {
      caption: caption,
    });
    console.log(`Mensagem de mídia enviada com sucesso ao número ${phoneNumber} pela instância ${sessionName} no horário ${new Date()}!`);
  } catch (error) {
    console.error(`Erro ao enviar mensagem de mídia: ${error.message}`);
    throw new Error(`Erro ao enviar mensagem de mídia: ${error.message}`);
  }
};

module.exports = { sendMediaMessage };

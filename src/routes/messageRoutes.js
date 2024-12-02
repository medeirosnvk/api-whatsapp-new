/* eslint-disable quotes */
const express = require("express");
const axios = require("axios");
const { MessageMedia } = require("whatsapp-web.js");
const sessionsManager = require("../sessionsManager");
const { validateAndFormatNumber } = require("../services/MessageServices/validateNumberService");

const messageRoutes = express.Router();

messageRoutes.post("/sendMessage", async (req, res) => {
  const { instanceName, number, mediaMessage } = req.body;
  const client = sessionsManager.getSession(instanceName);

  if (!instanceName || !number || !mediaMessage) {
    return res.status(400).send("instanceName, number, and mediaMessage are required");
  }

  try {
    const { fileName, caption, media } = mediaMessage;

    let processedNumber = number;
    const brazilCountryCode = "55";

    if (processedNumber.startsWith(brazilCountryCode) && processedNumber.length === 13) {
      processedNumber = processedNumber.slice(0, -1);
    }

    // Obter o arquivo de mídia
    const response = await axios.get(media, {
      responseType: "arraybuffer",
    });
    const mimeType = response.headers["content-type"];
    const mediaData = Buffer.from(response.data, "binary").toString("base64");

    const messageMedia = new MessageMedia(mimeType, mediaData, fileName);

    await client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log("Mensagem enviada com sucesso!");
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    res.status(404).send({
      status: 404,
      error: "Not Found",
      message: [`The "${instanceName}" instance does not exist`],
    });
  }
});

messageRoutes.post("/message/sendText/:instanceName", async (req, res) => {
  const { number, textMessage } = req.body;
  const { instanceName } = req.params;
  const client = sessionsManager.getSession(instanceName);

  if (!client || client.connectionState !== "open") {
    console.error(`Sessão "${instanceName}" não encontrada no sessionsManager ou não conectada.`);
    return res.status(404).send(`Sessão "${instanceName}" não encontrada no sessionsManager ou não conectada.`);
  } else {
    console.log(`Sessão encontrada para ${instanceName}`);
  }

  if (!instanceName || !number || !textMessage?.text) {
    return res.status(400).send("instanceName, number, e textMessage.text são obrigatórios");
  }

  try {
    let processedNumber = number;
    const brazilCountryCode = "55";

    if (processedNumber.startsWith(brazilCountryCode)) {
      const localNumber = processedNumber.slice(4);

      if (localNumber.length === 9 && localNumber.startsWith("9")) {
        processedNumber = brazilCountryCode + processedNumber.slice(2, 4) + localNumber.slice(1);
      }
    }

    await client.sendMessage(`${processedNumber}@c.us`, textMessage.text);

    console.log(`Mensagem de texto enviada com sucesso ao numero ${number} pela instancia ${instanceName} no horário ${new Date()}!`);
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error); // Loga o erro detalhado no console
    res.status(500).send({
      status: 500,
      error: "Internal Server Error",
      message: [`Erro ao enviar mensagem para a instância "${instanceName}": ${error.message}`],
      details: error.stack, // Inclui o stack trace completo (opcional)
    });
  }
});

messageRoutes.post("/message/sendMedia/:instanceName", async (req, res) => {
  const { number, mediaMessage } = req.body;
  const { instanceName } = req.params;
  const client = sessionsManager.getSession(instanceName);

  if (!client || client.connectionState !== "open") {
    console.error(`Sessão "${instanceName}" não encontrada no sessionsManager ou não conectada.`);
    return res.status(404).send(`Sessão "${instanceName}" não encontrada no sessionsManager ou não conectada.`);
  } else {
    console.log(`Sessão encontrada para ${instanceName}`);
  }

  if (!client || typeof client.sendMessage !== "function") {
    console.error(`Cliente inválido ou não inicializado corretamente para a instância "${instanceName}".`);
    return res.status(500).send({
      status: 500,
      error: "Client Not Ready",
      message: `O cliente para a instância "${instanceName}" não está pronto ou é inválido.`,
    });
  }

  console.log("Estado do cliente:", {
    client,
    connectionState: client.connectionState,
    sessionName: client.sessionName,
    availableMethods: Object.keys(client),
  });

  console.log("Sessões ativas no sessionsManager:", sessionsManager.getAllSessions());
  console.log("Tipo do client:", client.constructor?.name);

  if (!instanceName || !number || !mediaMessage || !mediaMessage.media) {
    return res.status(400).send("instanceName, number, and mediaMessage.media are required");
  }

  try {
    let processedNumber = number;
    const brazilCountryCode = "55";

    if (processedNumber.startsWith(brazilCountryCode)) {
      const localNumber = processedNumber.slice(4);

      if (localNumber.length === 9 && localNumber.startsWith("9")) {
        processedNumber = brazilCountryCode + processedNumber.slice(2, 4) + localNumber.slice(1);
      }
    }

    const { media, fileName, caption } = mediaMessage;

    // Obter o arquivo de mídia
    const response = await axios.get(media, { responseType: "arraybuffer" }).catch((error) => {
      if (error.response && error.response.status === 404) {
        console.error(`Mídia não encontrada no URL fornecido: ${media}`);
        res.status(404).send({ error: "Mídia não encontrada. Verifique a URL fornecida." });
      } else {
        console.error(`Erro ao obter a mídia: ${error.message}`);
        res.status(500).send({ error: "Erro interno ao obter a mídia." });
      }
      return null; // Impede processamento adicional
    });

    if (!response) return; // Sai se houve erro na obtenção da mídia

    const mimeType = response.headers["content-type"];
    const mediaData = Buffer.from(response.data, "binary").toString("base64");

    const messageMedia = new MessageMedia(mimeType, mediaData, fileName);

    await client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log(`Mensagem de media enviada com sucesso ao numero ${number} pela instancia ${instanceName} no horário ${new Date()}!`);
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error); // Loga o erro detalhado no console
    res.status(500).send({
      status: 500,
      error: "Internal Server Error",
      message: [`Erro ao enviar mensagem para a instância "${instanceName}": ${error.message}`],
      details: error.stack, // Inclui o stack trace completo (opcional)
    });
  }
});

messageRoutes.post("/chat/whatsappNumbers/:sessionName", async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { numbers } = req.body;

    const client = sessionsManager.getSession(sessionName);

    if (!client) {
      return res.status(500).json({ success: false, message: "Client is not initialized" });
    }

    if (!Array.isArray(numbers) || numbers.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input format. "numbers" should be an array containing exactly one number.',
      });
    }

    const number = numbers[0];

    // Valida e formata o número
    const formattedNumber = validateAndFormatNumber(number);

    try {
      const isRegistered = await client.isRegisteredUser(formattedNumber);

      if (isRegistered === true) {
        console.log(`Número ${number} existe no WhatsApp, isRegistered -`, isRegistered);
        return res.status(200).json([
          {
            exists: isRegistered,
          },
        ]);
      } else {
        console.log(`Número ${number} NÃO existe no WhatsApp, isRegistered -`, isRegistered);
        return res.status(404).json([
          {
            exists: isRegistered,
          },
        ]);
      }
    } catch (error) {
      console.error(`Erro ao verificar o número ${number}:`, error.message);
      return res.status(404).json([
        {
          exists: false,
        },
      ]);
    }
  } catch (error) {
    console.error("Erro na rota whatsappNumbers", error.message);
    return res.status(404).json([
      {
        exists: false,
      },
    ]);
  }
});

module.exports = messageRoutes;

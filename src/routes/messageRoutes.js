/* eslint-disable quotes */
const express = require("express");
const { sendTextMessage } = require("../services/MessageServices/sendTextMessageService");
const { sendMediaMessage } = require("../services/MessageServices/sendMediaMessageService");
const { checkWhatsappNumber } = require("../services/MessageServices/checkWhatsappNumberService");

const messageRoutes = express.Router();

messageRoutes.post("/message/sendText/:instanceName", async (req, res) => {
  const { number, textMessage } = req.body;
  const { instanceName } = req.params;

  if (!instanceName || !number || !textMessage?.text) {
    return res.status(400).send("instanceName, number, e textMessage.text são obrigatórios");
  }

  try {
    await sendTextMessage(instanceName, number, textMessage);
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error.message);
    res.status(500).json({ error: error.message });
  }
});

messageRoutes.post("/message/sendMedia/:instanceName", async (req, res) => {
  const { number, mediaMessage } = req.body;
  const { instanceName } = req.params;

  if (!instanceName || !number || !mediaMessage || !mediaMessage.media) {
    return res.status(400).send("instanceName, number, and mediaMessage.media are required");
  }

  try {
    await sendMediaMessage(instanceName, number, mediaMessage);
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error.message);
    res.status(500).json({ error: error.message });
  }
});

messageRoutes.post("/chat/whatsappNumbers/:sessionName", async (req, res) => {
  const { sessionName } = req.params;
  const { numbers } = req.body;
  const number = numbers[0];

  try {
    const statusWhatsappNumber = await checkWhatsappNumber(sessionName, number);

    if (statusWhatsappNumber && statusWhatsappNumber === true) {
      return res.status(200).json([
        {
          exists: statusWhatsappNumber,
        },
      ]);
    } else {
      return res.status(404).json([
        {
          exists: statusWhatsappNumber,
        },
      ]);
    }
  } catch (error) {
    console.error(`Erro ao verificar o número ${number}:`, error.message);
    return res.status(500).json([
      {
        exists: false,
      },
    ]);
  }
});

module.exports = messageRoutes;

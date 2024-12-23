const express = require("express");
const { sendTextMessage } = require("../services/MessageServices/sendTextMessageService");
const { sendMediaMessage } = require("../services/MessageServices/sendMediaMessageService");
const { checkWhatsappNumber } = require("../services/MessageServices/checkWhatsappNumberService");
const { sendBase64Message, sendAudioBase64Message } = require("../services/MessageServices/sendBase64MessageService");

const messageRoutes = express.Router();

/**
 * @swagger
 * /message/sendText/{instanceName}:
 *   post:
 *     summary: Envia uma mensagem de texto para um número via WhatsApp.
 *     tags: [Message]
 *     parameters:
 *       - in: path
 *         name: instanceName
 *         required: true
 *         description: Nome da instância.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number:
 *                 type: string
 *                 description: Número de telefone para o qual a mensagem será enviada.
 *               textMessage:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *                     description: Texto da mensagem.
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: PENDING
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos.
 *       500:
 *         description: Erro ao enviar a mensagem.
 */
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

/**
 * @swagger
 * /message/sendMedia/{instanceName}:
 *   post:
 *     summary: Envia uma mensagem de mídia (imagem, vídeo, documento) para um número via WhatsApp.
 *     tags: [Message]
 *     parameters:
 *       - in: path
 *         name: instanceName
 *         required: true
 *         description: Nome da instância.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - mediaMessage
 *             properties:
 *               number:
 *                 type: string
 *                 description: Número de telefone para o qual a mídia será enviada (incluindo o código do país).
 *                 example: "555199999999"
 *               mediaMessage:
 *                 type: object
 *                 description: Detalhes da mensagem de mídia.
 *                 properties:
 *                   mediatype:
 *                     type: string
 *                     description: Tipo da mídia
 *                     example: "document"
 *                   fileName:
 *                     type: string
 *                     description: Nome do arquivo de mídia.
 *                     example: "documento.pdf"
 *                   caption:
 *                     type: string
 *                     description: Legenda da mídia, caso haja.
 *                     example: "Boa tarde, aqui está o documento."
 *                   media:
 *                     type: string
 *                     description: URL ou caminho para o arquivo de mídia.
 *                     example: "https://exemplo.com.br/media/documento.pdf"
 *     responses:
 *       200:
 *         description: Mídia enviada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos.
 *       500:
 *         description: Erro ao enviar a mensagem de mídia.
 */
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

/**
 * @swagger
 * /message/sendBase64/{instanceName}:
 *   post:
 *     summary: Envia uma mensagem de mídia em Base64 para um número via WhatsApp.
 *     tags: [Message]
 *     parameters:
 *       - in: path
 *         name: instanceName
 *         required: true
 *         description: Nome da instância.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - mediaMessage
 *             properties:
 *               number:
 *                 type: string
 *                 description: Número de telefone para o qual a mídia será enviada (incluindo o código do país).
 *                 example: "555199999999"
 *               mediaMessage:
 *                 type: object
 *                 description: Detalhes da mensagem de mídia em Base64.
 *                 required:
 *                   - base64
 *                   - fileName
 *                   - mimeType
 *                 properties:
 *                   base64:
 *                     type: string
 *                     description: Imagem ou vídeo em formato Base64.
 *                     example: "<BASE64>"
 *                   fileName:
 *                     type: string
 *                     description: Nome do arquivo de mídia.
 *                     example: "audio.mpeg"
 *                   mimeType:
 *                     type: string
 *                     description: Tipo MIME do arquivo de mídia.
 *                     example: "audio/mpeg"
 *                   caption:
 *                     type: string
 *                     description: Legenda da mídia, caso haja.
 *                     example: "Ouça este áudio de teste, Kevin!"
 *     responses:
 *       200:
 *         description: Mídia Base64 enviada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos.
 *       500:
 *         description: Erro ao enviar a mensagem de Base64.
 */
messageRoutes.post("/message/sendBase64/:instanceName", async (req, res) => {
  const { number, mediaMessage } = req.body;
  const { instanceName } = req.params;

  if (!instanceName || !number || !mediaMessage || !mediaMessage.base64) {
    return res.status(400).send("instanceName, number, and mediaMessage.base64 are required");
  }

  try {
    await sendBase64Message(instanceName, number, mediaMessage);
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /chat/whatsappNumbers/{sessionName}:
 *   post:
 *     summary: Verifica se um número de WhatsApp existe.
 *     tags: [Message]
 *     parameters:
 *       - in: path
 *         name: sessionName
 *         required: true
 *         description: Nome da sessão.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               numbers:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Lista de números para verificar.
 *     responses:
 *       200:
 *         description: Números verificados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   exists:
 *                     type: boolean
 *                     example: true
 *       500:
 *         description: Erro ao verificar os números.
 */
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

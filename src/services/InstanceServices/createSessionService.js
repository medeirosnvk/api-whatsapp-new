require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const { saveQRCodeImage } = require("./saveQRCodeImageService");
const fs = require("fs");
const StateMachine = require("../../services/InstanceServices/stateMachineService");
const axios = require("axios");
const path = require("path");
const saveClientDataService = require("../../services/InstanceServices/saveClientDataService");
const sessionsManager = require("../../services/sessionsManager");
const welcomeMessages = require("../MessageServices/welcomeMessagesService");
const qrcode = require("qrcode-terminal");
const requests = require("../requests");
const utils = require("../utils");

const sessionsInProgress = new Set();

const port = process.env.PORT;
const urlHostIP = process.env.HOST_IP;
const urlWebhookMedia = `${urlHostIP}:${port}`;

const createSession = async (sessionName) => {
  const session = sessionsManager.getSession(sessionName);

  // Verifica se a sessão já está sendo criada e não está conectada
  if (sessionsInProgress.has(sessionName)) {
    if (session && session.connectionState !== "open") {
      console.log(`A sessão ${sessionName} já está sendo criada. Aguardando...`);
      return null; // A sessão está sendo criada, aguardar
    }
  }

  // Marca a sessão como em criação
  sessionsInProgress.add(sessionName);

  // Se a sessão já existir, mas não estiver conectada, loga que está em processo
  if (session) {
    if (session.connectionState === "open") {
      console.log(`A sessão ${sessionName} já está conectada.`);
      return session; // Retorna a sessão se já estiver conectada
    }
    console.log(`A sessão ${sessionName} existe, mas não está conectada.`);
  }

  let isQRFunctionExposed = false;

  try {
    const localAuth = new LocalAuth({ clientId: sessionName });
    const client = new Client({
      authStrategy: localAuth,
      puppeteer: {
        headless: true,
        args: [
          "--no-default-browser-check",
          "--disable-session-crashed-bubble",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
        ],
      },
    });

    client.sessionName = sessionName;
    client.connectionState = "connecting";

    // Atualiza a sessão no SessionManager
    sessionsManager.addSession(sessionName, client, { connectionState: "connecting" });

    const qrTimeout = setTimeout(() => {
      if (client.connectionState !== "open") {
        client.connectionState = "disconnected";
        console.log(`Tempo esgotado para a sessão ${sessionName}. Desconectando...`);
        client.destroy();
        sessionsManager.removeSession(sessionName);
      }
    }, 2 * 60 * 30000);

    client.on("qr", async (qr) => {
      try {
        if (!isQRFunctionExposed) {
          console.log(`QR Code para a sessão ${sessionName}:`);
          qrcode.generate(qr, { small: true });
          await saveQRCodeImage(qr, sessionName);
          isQRFunctionExposed = true;
        }
      } catch (error) {
        console.error("Erro ao lidar com QR Code:", error.message);
      }
    });

    client.on("ready", async () => {
      try {
        if (qrTimeout) {
          clearTimeout(qrTimeout);
          console.log("Timeout de QR Code limpo com sucesso.");
        }

        client.connectionState = "open";

        // Salvar os dados do cliente no sessionManager
        saveClientDataService.addOrUpdateDataSession(client);
        sessionsManager.updateSession(sessionName, {
          client,
          connectionState: "open",
        });

        console.log(`Sessão ${sessionName} foi salva como 'open' no sessionsManager.`);
        console.log(`Sessão ${sessionName} está pronta!`);

        // Configuração da máquina de estado
        new StateMachine(client, sessionName);
      } catch (error) {
        console.error(`Erro ao configurar a sessão "${sessionName}":`, error);
        sessionsManager.removeSession(sessionName);
      }
    });

    client.on("disconnected", async (data) => {
      try {
        clearTimeout(qrTimeout);
        console.error(`Sessão ${sessionName} foi desconectada.`);

        client.connectionState = "disconnected";
        sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });
        saveClientDataService.addOrUpdateDataSession(client);

        await client.logout();
      } catch (error) {
        console.error("Erro ao lidar com desconexão:", error.message);

        if (
          error.message.includes("Cannot read properties of undefined") ||
          error.message.includes("ENOTEMPTY") ||
          error.message.includes("Protocol error (Runtime.callFunctionOn): Target closed")
        ) {
          console.error("Erro ao acessar propriedades indefinidas ou diretório não vazio durante a desconexão:", error.message);
          sessionsManager.updateSession(sessionName, { connectionState: "banned" });
          saveClientDataService.addOrUpdateDataSession(client);
        }
      }
    });

    client.on("auth_failure", async (data) => {
      clearTimeout(qrTimeout);
      console.error(`Sessão ${sessionName} falhou na autenticação.`);

      client.connectionState = "auth_failure";
      sessionsManager.updateSession(sessionName, { connectionState: "auth_failure" });
      saveClientDataService.addOrUpdateDataSession(client);

      if (data.includes("ban")) {
        console.error(`A sessão ${sessionName} foi banida.`);
        sessionsManager.updateSession(sessionName, { connectionState: "banned" });
      }
    });

    client.on("connection-state-changed", async (state) => {
      console.log(`Estado da conexão mudou para ${sessionName}:`, state);
      sessionsManager.updateSession(sessionName, { connectionState: state });
    });

    client.on("group_join", async (notification) => {
      const { chatId, recipientIds } = notification;

      const groupChat = await client.getChatById(chatId);
      const customMessage = welcomeMessages.get(chatId) || "👋 Bem-vindo(a)!";

      for (const wid of recipientIds) {
        const contato = await client.getContactById(wid);
        await groupChat.sendMessage(`@${contato.number}\n\n${customMessage}`);
      }
    });

    client.on("group_leave", async (notification) => {
      const { chatId, author } = notification;
      const groupChat = await client.getChatById(chatId);
      await groupChat.sendMessage(`😢 O usuário saiu do grupo: ${author}`);
    });

    client.on("message", async (message) => {
      try {
        if (client.connectionState !== "open") {
          console.log(`Sessão ${sessionName} está desconectada. Ignorando mensagem.`);
          return;
        }

        console.log(`Sessão ${sessionName} recebeu a mensagem: ${message.body} de ${message.from} no horário ${new Date()}`);

        let mediaName = "";
        let mediaUrl = "";
        let mediaBase64 = "";
        let ticketId;
        let bot_idstatus;

        const stateMachine = StateMachine.getStateMachine(sessionName);
        const { body, from, to } = message;

        if (!stateMachine) {
          console.error(`StateMachine não encontrada para a sessão ${sessionName}`);
          return;
        }

        const response = {
          from: message.from,
          body: message.body,
        };

        const fromPhoneNumber = utils.formatPhoneNumber(message.from);
        console.log(`Numero atual - ${message.from} e Numero formatado - ${fromPhoneNumber}`);

        if (message.hasMedia) {
          try {
            // Fazer o download da mídia
            const media = await message.downloadMedia();
            const mediaPath = path.join(__dirname, "../../media", fromPhoneNumber);

            // Garantir que o diretório existe
            if (!fs.existsSync(mediaPath)) {
              fs.mkdirSync(mediaPath, { recursive: true });
            }

            // Definir o nome e o caminho do arquivo
            const fileName = `${new Date().getTime()}.${media.mimetype.split("/")[1]}`;
            const filePath = path.join(mediaPath, fileName);

            // Salvar o arquivo e verificar se foi salvo corretamente
            fs.writeFileSync(filePath, media.data, "base64");

            if (fs.existsSync(filePath)) {
              console.log(`Arquivo recebido e salvo em: ${filePath}`);
              mediaName = fileName;
              mediaUrl = `${urlWebhookMedia}/media/${fromPhoneNumber}/${fileName}`;
              mediaBase64 = media.data;
            } else {
              console.error(`O arquivo não foi salvo corretamente em ${filePath}`);
            }
          } catch (error) {
            console.error(`Erro ao processar mídia para a sessão ${sessionName}:`, error);
          }
        }

        try {
          // Enviar os dados para o webhook
          await axios.post(urlWebhookResponse, {
            sessionName,
            message: {
              ...message,
              body: mediaName || message.body,
              mediaName,
              mediaUrl,
              mediaBase64,
            },
          });
        } catch (error) {
          console.error(`Erro ao enviar dados para o webhook para a sessão ${sessionName}:`, error);
        }

        if (!fromPhoneNumber || !response) {
          console.log("Mensagem inválida recebida", message.body);
          return;
        }

        try {
          const credorExistsFromDB = await stateMachine.getCredorFromDB(fromPhoneNumber);
          if (!credorExistsFromDB) {
            console.log("Credor sem cadastro no banco de dados. Atendimento chatbot não iniciado para -", fromPhoneNumber);
            return;
          }

          const statusAtendimento = await requests.getStatusAtendimento(fromPhoneNumber);
          // const bot_idstatus = statusAtendimento[0]?.bot_idstatus;
          const bot_idstatus = 2;

          if (!bot_idstatus) {
            console.log("Status de atendimento não encontrado para o usuário -", fromPhoneNumber);
          } else if (bot_idstatus === 2) {
            console.log("Usuário em atendimento humano -", bot_idstatus);

            if (!redirectSentMap.get(fromPhoneNumber)) {
              await client.sendMessage(from, "Estamos redirecionando seu atendimento para um atendente humano, por favor aguarde...");
              redirectSentMap.set(fromPhoneNumber, true);
            }
            return;
          } else if ([1, 3].includes(bot_idstatus) || bot_idstatus === "") {
            console.log("Usuário em atendimento automático -", bot_idstatus);
          }

          const ticketStatus = await requests.getTicketStatusByPhoneNumber(fromPhoneNumber);

          if (ticketStatus && ticketStatus.length > 0) {
            ticketId = ticketStatus[0].id;
            await requests.getAbrirAtendimentoBot(ticketId);
            console.log(`Iniciando atendimento Bot para ${fromPhoneNumber} no Ticket - ${ticketId}`);
          } else {
            await requests.getInserirNumeroCliente(fromPhoneNumber);

            const insertNovoTicket = await requests.getInserirNovoTicket(fromPhoneNumber);

            if (insertNovoTicket && insertNovoTicket.insertId) {
              ticketId = insertNovoTicket.insertId;
              await requests.getAbrirAtendimentoBot(ticketId);
              console.log(`Iniciando atendimento Bot para ${fromPhoneNumber} no Ticket - ${ticketId} (NOVO)`);
            } else {
              console.log("Erro ao criar novo número de Ticket no banco.");
              return;
            }
          }

          const demim = 0;

          stateMachine.setTicketId(ticketId);
          stateMachine.setFromNumber(from);
          stateMachine.setToNumber(to);

          await stateMachine.getRegisterMessagesDB(from, to, message.body, ticketId, demim);
          await stateMachine.handleMessage(fromPhoneNumber, response);
        } catch (error) {
          console.error("Erro ao processar a mensagem:", error);
        }
      } catch (error) {
        console.error("Erro ao lidar com a mensagem:", error);
      }
    });

    await client.initialize();

    return client;
  } catch (error) {
    console.error(`Erro ao criar a sessão ${sessionName}:`, error);
    sessionsManager.removeSession(sessionName);
  }
};

module.exports = {
  createSession,
};

/* eslint-disable no-unused-vars */
const sessionsManager = require("../../sessionsManager");
const utils = require("../utils");
const requests = require("../requests");
const qrcode = require("qrcode-terminal");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { saveQRCodeImage } = require("./saveQRCodeImageService");
const saveClientDataService = require("../../services/InstanceServices/saveClientDataService");
const StateMachine = require("../../services/InstanceServices/stateMachineService");

const createSession = async (sessionName) => {
  const existingSession = sessionsManager.getSession(sessionName);

  if (existingSession && existingSession.connectionState === "open") {
    console.log(`A instância ${sessionName} já está conectada.`);
    return;
  }

  let client;
  let isQRFunctionExposed = false;
  let isSessionTimedOut = false;

  try {
    const localAuth = new LocalAuth({ clientId: sessionName });

    delete localAuth.logout;
    localAuth.logout = async () => {
      try {
        console.log("Executando logout...");

        if (this.userDataDir) {
          await fs.promises.rm(this.userDataDir, {
            recursive: true,
            force: true,
          });
          console.log(`Diretório de dados do usuário ${this.userDataDir} removido com sucesso.`);
        }
      } catch (error) {
        console.error("Erro ao remover o diretório de dados do usuário:", error);
      }
    };

    client = new Client({
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

    client.connectionState = "connecting";
    client.sessionName = sessionName;

    const qrTimeout = setTimeout(() => {
      if (!isSessionTimedOut && client.connectionState !== "open") {
        console.log(`Tempo esgotado para a sessão ${sessionName}. Finalizando...`);
        isSessionTimedOut = true;

        client.connectionState = "disconnected";
        sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });

        client.destroy(); // Finaliza o cliente
      }
    }, 30 * 60 * 1000);

    client.on("loading_screen", (percent, message) => {
      console.log("Carregando...", percent, message);
    });

    client.on("change_state", (data) => {
      console.log(`Mudando status da Sessão ${sessionName} -`, JSON.stringify(data, undefined, 2));
    });

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

    client.on("disconnected", async (data) => {
      try {
        console.log("DISCONNECTED -", JSON.stringify(data, undefined, 2));

        clearTimeout(qrTimeout);
        console.log(`Sessão ${sessionName} foi desconectada.`);

        await client.logout();
        client.connectionState = "disconnected";

        sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });
      } catch (error) {
        console.error("Erro ao lidar com desconexão:", error.message);

        if (
          error.message.includes("Cannot read properties of undefined") ||
          error.message.includes("ENOTEMPTY") ||
          error.message.includes("Protocol error (Runtime.callFunctionOn): Target closed")
        ) {
          console.error("Erro ao acessar propriedades indefinidas ou diretório não vazio durante a desconexão:", error.message);
          client.connectionState = "banned";
          sessionsManager.updateSession(sessionName, { connectionState: "banned" });
          saveClientDataService.addOrUpdateDataSession(client);
        } else {
          // Caso contrário, marque como desconectado
          client.connectionState = "disconnected";
          sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });
          saveClientDataService.addOrUpdateDataSession(client);
        }
      }
    });

    client.on("authenticated", (data) => {
      clearTimeout(qrTimeout);
      console.log(`Cliente ${client.sessionName} autenticado com sucesso.`);

      try {
        client.connectionState = "authenticated"; // Atualiza o estado
        sessionsManager.addSession(sessionName, client);
        new StateMachine(client, client.sessionName);
      } catch (error) {
        console.error("Erro ao criar StateMachine ou atualizar sessão:", error);
      }
    });

    client.on("auth_failure", (data) => {
      console.log("AUTH_FAILURE -", JSON.stringify(data, undefined, 2));

      clearTimeout(qrTimeout);
      client.connectionState = "disconnected";

      sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });

      console.error(`Falha de autenticação na sessão ${sessionName}. Verifique suas credenciais.`);

      if (data.includes("ban")) {
        client.connectionState = "banned";
        console.error(`A sessão ${client.sessionName} foi banida.`);
        sessionsManager.updateSession(sessionName, { connectionState: "banned" });
      } else {
        sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });
      }
    });

    client.on("ready", async () => {
      if (!isSessionTimedOut) {
        clearTimeout(qrTimeout);
        console.log(`QR Timeout limpo para a sessão ${sessionName}.`);
      }

      console.log(`Sessão ${sessionName} está pronta!`);
      client.connectionState = "open";

      try {
        // Adiciona o client ao sessionsManager
        sessionsManager.addSession(sessionName, client);

        // Cria o clientData e adiciona dentro do sessionsManager
        const clientData = saveClientDataService.addOrUpdateDataSession(client);
        sessionsManager.updateSession(sessionName, {
          connectionState: "open",
          clientData,
        });

        // Cria nova instancia no StateMachine
        new StateMachine(client, client.sessionName);
      } catch (error) {
        console.error("Erro ao criar arquivo clientData.json:", error);
      }
    });

    // client.on("message", async (message) => {
    //   try {
    //     console.log(`Mensagem ${message.body} recebida de ${message.from} as ${new Date()}`);

    //     if (message.body === "ping") {
    //       message.reply("pong");
    //     }
    //   } catch (error) {
    //     console.error("Erro ao processar com a mensagem:", error);
    //   }
    // });

    client.on("message", async (message) => {
      try {
        const stateSession = sessionsManager.getSession(sessionName);
        const stateMachine = StateMachine.getStateMachine(sessionName);

        if (stateSession !== "open") {
          console.log(`Sessão ${sessionName} está desconectada. Ignorando mensagem...`);
          return;
        }

        if (!stateMachine) {
          console.error(`StateMachine não encontrada para a sessão ${sessionName}.`);
          return;
        }

        console.log(`Sessão ${sessionName} recebeu a mensagem: ${message.body} de ${message.from} no horário ${new Date()}`);

        let mediaName = "";
        let mediaUrl = "";
        let mediaBase64 = "";
        let ticketId;
        let redirectSentMap = new Map();
        let bot_idstatus;

        const demim = 0;
        const { body, from, to } = message;
        const response = { from, body };
        const fromPhoneNumber = utils.formatPhoneNumber(message.from);
        const webhookUrl = "http://www.cobrance.com.br/codechat/webhook_cobrance.php";

        if (!fromPhoneNumber || !response) {
          console.log("Mensagem inválida recebida.", message.body);
          return;
        }

        // Se tiver arquivo de media na mensagem, salvar arquivo
        if (message.hasMedia) {
          try {
            const media = await message.downloadMedia();
            const mediaPath = path.join(__dirname, "media", fromPhoneNumber);

            if (!fs.existsSync(mediaPath)) {
              fs.mkdirSync(mediaPath, { recursive: true });
            }

            const fileName = `${new Date().getTime()}.${media.mimetype.split("/")[1]}`;
            const filePath = path.join(mediaPath, fileName);

            fs.writeFileSync(filePath, media.data, "base64");
            console.log(`Arquivo recebido e salvo em: ${filePath}`);

            mediaName = fileName;
            mediaUrl = `http://191.252.214.9:3060/media/${fromPhoneNumber}/${fileName}`;
            mediaBase64 = media.data;
          } catch (error) {
            console.error(`Erro ao processar mídia para a sessão ${sessionName}:`, error);
          }
        }

        // Tenta enviar ao webhook via axios
        try {
          await axios.post(webhookUrl, {
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

        try {
          const credorExistsFromDB = await StateMachine.getCredorFromDB(fromPhoneNumber);
          const statusAtendimento = await requests.getStatusAtendimento(fromPhoneNumber);
          const ticketStatus = await requests.getTicketStatusByPhoneNumber(fromPhoneNumber);
          const bot_idstatus = statusAtendimento[0]?.bot_idstatus;

          // Verifica se o devedor existe no banco
          if (!credorExistsFromDB) {
            console.log("Credor sem cadastro no banco de dados. Atendimento chatbot não iniciado para -", fromPhoneNumber);
            return;
          }

          // Classifica status de atendimento do usuario
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

          // Se ja existe ticked, mantem o mesmo, se nao, insere um novo ticket
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

          // Se todo o fluxo seguir de acordo, encaminha usuario ao fluxo de atendimento do bot
          StateMachine.setTicketId(ticketId);
          StateMachine.setFromNumber(from);
          StateMachine.setToNumber(to);

          await StateMachine.getRegisterMessagesDB(from, to, message.body, ticketId, demim);
          await StateMachine.handleMessage(fromPhoneNumber, response);
        } catch (error) {
          console.error("Erro ao processar a mensagem:", error);
        }
      } catch (error) {
        console.error("Erro ao processar com a mensagem:", error);
      }
    });

    client.initialize();
    return client;
  } catch (error) {
    console.error(`Erro ao criar a sessão ${sessionName}:`, error);
  }
};

module.exports = {
  createSession,
};

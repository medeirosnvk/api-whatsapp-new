const sessionsManager = require("../../sessionsManager");
const { stateMachines } = require("../InstanceServices/stateMachineService");

const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { saveQRCodeImage } = require("./saveQRCodeImageService");
const { saveClientData } = require("./saveClientDataService");
const StateMachine = require("../InstanceServices/stateMachineService");

let sessions = {};

const createSession = async (sessionName) => {
  const existingSession = sessionsManager.getSession(sessionName);

  if (existingSession && existingSession.connectionState === "open") {
    console.log(`A instância ${sessionName} já está conectada.`);
    return;
  }

  let client;
  let isQRFunctionExposed = false;

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

    sessionsManager.updateSession(sessionName, {
      connectionState: "connecting",
    });

    const qrTimeout = setTimeout(() => {
      const sessionData = sessionsManager.getSession(sessionName);

      if (sessionData && sessionData.connectionState !== "open") {
        console.log(`Tempo esgotado para a sessão ${sessionName}. Desconectando...`);

        sessionsManager.updateSession(sessionName, {
          connectionState: "disconnected",
        });

        if (sessionData.client) {
          sessionData.client.destroy();
        }
      }
    }, 30 * 60 * 1000); // 30 minutos

    client.on("loading_screen", (percent, message) => {
      console.log("Carregando...", percent, message);
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
        sessionsManager.updateSession(sessionName, {
          connectionState: "disconnected",
        });
      } catch (error) {
        console.error("Erro ao lidar com desconexão:", error.message);

        if (
          error.message.includes("Cannot read properties of undefined") ||
          error.message.includes("ENOTEMPTY") ||
          error.message.includes("Protocol error (Runtime.callFunctionOn): Target closed")
        ) {
          console.error("Erro ao acessar propriedades indefinidas ou diretório não vazio durante a desconexão:", error.message);

          sessionsManager.updateSession(sessionName, {
            connectionState: "banned",
          });
          saveClientData(client);
        } else {
          // Caso contrário, marque como desconectado
          sessionsManager.updateSession(sessionName, {
            connectionState: "disconnected",
          });
          saveClientData(client);
        }
      }
    });

    client.on("authenticated", (data) => {
      console.log("AUTHENTICATED -", JSON.stringify(data, undefined, 2));
      clearTimeout(qrTimeout);

      try {
        // Atualiza o estado da sessão para "open" no sessionsManager
        sessionsManager.updateSession(client.sessionName, {
          connectionState: "open",
          client: client,
        });
        console.log(`Conexão bem-sucedida na sessão ${client.sessionName}!`);

        // Cria a máquina de estado para a sessão
        const stateMachine = new StateMachine(client, client.sessionName);
        stateMachines[client.sessionName] = stateMachine; // Registra a máquina de estado
      } catch (error) {
        console.error("Erro ao criar StateMachine ou atualizar sessão:", error);
      }
    });

    client.on("auth_failure", (data) => {
      console.log("AUTH_FAILURE -", JSON.stringify(data, undefined, 2));

      clearTimeout(qrTimeout);
      client.connectionState = "disconnected";
      console.error(`Falha de autenticação na sessão ${sessionName}. Verifique suas credenciais.`);

      if (data.includes("ban")) {
        client.connectionState = "banned";
        console.error(`A sessão ${client.sessionName} foi banida.`);
        sessions[sessionName].connectionState === "banned";
      } else {
        client.connectionState = "disconnected";
      }
    });

    client.on("ready", async () => {
      clearTimeout(qrTimeout);
      client.connectionState = "open";
      console.log(`Sessão ${sessionName} está pronta!`);

      const debugWWebVersion = await client.getWWebVersion();
      console.log(`WWebVersion = ${debugWWebVersion}`);

      client.pupPage.on("load", async (err) => {
        // console.log("loadError: " + err.toString());
      });

      client.pupPage.on("pageerror", function (err) {
        // console.log("pageError: " + err.toString());
      });

      client.pupPage.on("error", function (err) {
        // console.log("error: " + err.toString());
      });

      try {
        saveClientData(client);
        const stateMachine = new StateMachine(client, client.sessionName);
        stateMachines[client.sessionName] = stateMachine;
      } catch (error) {
        console.error("Erro ao criar arquivo clientData.json:", error);
      }
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

        const stateMachine = stateMachines[sessionName];
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
        const webhookUrl = "http://www.cobrance.com.br/codechat/webhook_cobrance.php";

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

        if (!fromPhoneNumber || !response) {
          console.log("Mensagem inválida recebida", message.body);
          return;
        }

        try {
          const credorExistsFromDB = await stateMachine._getCredorFromDB(fromPhoneNumber);
          if (!credorExistsFromDB) {
            console.log("Credor sem cadastro no banco de dados. Atendimento chatbot não iniciado para -", fromPhoneNumber);
            return;
          }

          const statusAtendimento = await requests.getStatusAtendimento(fromPhoneNumber);
          const bot_idstatus = statusAtendimento[0]?.bot_idstatus;

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

          stateMachine._setTicketId(ticketId);
          stateMachine._setFromNumber(from);
          stateMachine._setToNumber(to);

          await stateMachine._getRegisterMessagesDB(from, to, message.body, ticketId, demim);
          await stateMachine.handleMessage(fromPhoneNumber, response);
        } catch (error) {
          console.error("Erro ao processar a mensagem:", error);
        }
      } catch (error) {
        console.error("Erro ao lidar com a mensagem:", error);
      }
    });

    client.on("change_state", (data) => {
      console.log(`Mudando status da Sessão ${sessionName} -`, JSON.stringify(data, undefined, 2));
    });

    client.initialize();
    sessions[sessionName] = client;
  } catch (error) {
    console.error(`Erro ao criar a sessão ${sessionName}:`, error);
  }

  return client;
};

module.exports = {
  createSession,
};

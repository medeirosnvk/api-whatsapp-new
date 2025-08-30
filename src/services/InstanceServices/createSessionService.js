require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const { saveQRCodeImage } = require("./saveQRCodeImageService");
const fs = require("fs");
const StateMachine = require("../../services/InstanceServices/stateMachineService");
const axios = require("axios");
const path = require("path");
const saveClientDataService = require("../../services/InstanceServices/saveClientDataService");
const sessionsManager = require("../../services/sessionsManager");
const qrcode = require("qrcode-terminal");
const requests = require("../requests");
const utils = require("../utils");
const { exec } = require("child_process");
const { executeQuery } = require("../../db/dbconfig");

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
        headless: "new",
        args: [
          "--no-default-browser-check",
          "--disable-session-crashed-bubble",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--disable-gpu",
          "--disable-translations",
          "--disable-extensions",
          "--disable-setuid-sandbox",
          "--no-zygote",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        defaultViewport: null,
        timeout: 60000,
        protocolTimeout: 30000,
        browserWSEndpoint: null,
        ignoreHTTPSErrors: true,
      },
    });

    client.sessionName = sessionName;
    client.connectionState = "connecting";

    // Atualiza a sessão no SessionManager
    sessionsManager.addSession(sessionName, client, { connectionState: "connecting" });

    const qrTimeout = setTimeout(async () => {
      if (client.connectionState !== "open") {
        try {
          client.connectionState = "disconnected";
          console.log(`Tempo esgotado para a sessão ${sessionName}. Desconectando...`);

          // Garante que todas as operações pendentes sejam concluídas
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (client.pupPage && !client.pupPage.isClosed()) {
            await client.pupPage.close().catch(() => {});
          }

          await client.destroy().catch(() => {});
          sessionsManager.removeSession(sessionName);
          sessionsInProgress.delete(sessionName);
        } catch (error) {
          console.error(`Erro ao limpar sessão ${sessionName} após timeout:`, error);
        }
      }
    }, 30 * 60 * 1000);

    client.on("qr", async (qr) => {
      try {
        if (!isQRFunctionExposed) {
          console.log(`QR Code para a sessão ${sessionName}:`);
          console.log(`Estado atual da conexão: ${client.connectionState}`);
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
        console.log(`Evento ready disparado para sessão ${sessionName}`);
        console.log(`Estado anterior: ${client.connectionState}`);

        if (qrTimeout) {
          clearTimeout(qrTimeout);
          console.log("Timeout de QR Code limpo com sucesso.");
        }

        client.connectionState = "open";
        console.log(`Novo estado após ready: ${client.connectionState}`);

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
      let hasBeenClosed = false;
      try {
        clearTimeout(qrTimeout);
        console.log(`Iniciando processo de desconexão para sessão ${sessionName}`);

        // Primeiro remover todos os listeners para evitar callbacks durante o processo de desconexão
        client.removeAllListeners("message");
        client.removeAllListeners("change_state");
        client.removeAllListeners("qr");
        client.removeAllListeners("ready");

        // Atualizar estados imediatamente
        client.connectionState = "disconnected";
        sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });

        // Salvar o estado atual
        try {
          await saveClientDataService.addOrUpdateDataSession(client);
        } catch (saveError) {
          console.log(`Erro ao salvar estado da sessão ${sessionName}:`, saveError.message);
        }

        // Aguardar um momento antes de começar a limpeza
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Tentar fazer logout e limpar página de forma segura
        if (client.pupPage && !hasBeenClosed) {
          try {
            const page = client.pupPage;
            if (!page.isClosed()) {
              // Desativar listeners da página
              await page
                .evaluate(() => {
                  window.onbeforeunload = null;
                  window.onunload = null;
                })
                .catch(() => {});

              // Tentar fazer logout com timeout
              await Promise.race([client.logout(), new Promise((resolve) => setTimeout(resolve, 5000))]).catch(() => {});

              // Fechar página se ainda não foi fechada
              if (!page.isClosed()) {
                await page.close().catch(() => {});
              }
            }
          } catch (pageError) {
            console.log(`Erro ao limpar página para sessão ${sessionName}:`, pageError.message);
          }
        }

        // Aguardar mais um momento
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Tentar fechar o browser com timeout
        if (client.pupBrowser && !hasBeenClosed) {
          try {
            const browser = client.pupBrowser;
            if (browser.isConnected()) {
              await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 5000))]).catch(() => {});
            }
          } catch (browserError) {
            console.log(`Erro ao fechar browser para sessão ${sessionName}:`, browserError.message);
          }
        }

        // Marcar como fechado e limpar referências
        hasBeenClosed = true;
        client.pupPage = null;
        client.pupBrowser = null;

        console.log(`Sessão ${sessionName} desconectada e recursos liberados`);
        sessionsInProgress.delete(sessionName);
      } catch (error) {
        console.error(`Erro durante a desconexão da sessão ${sessionName}:`, error.message);

        // Garantir que a sessão seja marcada como desconectada mesmo em caso de erro
        try {
          if (!hasBeenClosed) {
            sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });
            await saveClientDataService.addOrUpdateDataSession(client);

            // Limpar referências mesmo em caso de erro
            client.pupPage = null;
            client.pupBrowser = null;
            hasBeenClosed = true;
          }

          sessionsInProgress.delete(sessionName);
        } catch (finalError) {
          console.error(`Erro final ao atualizar estado da sessão ${sessionName}:`, finalError.message);
        }
      }
    });

    client.on("auth_failure", async (data) => {
      try {
        clearTimeout(qrTimeout);
        console.error(`Sessão ${sessionName} falhou na autenticação. Motivo:`, data);

        const newState = data?.includes("ban") ? "banned" : "auth_failure";
        client.connectionState = newState;

        // Atualizar estado no gerenciador de sessões
        sessionsManager.updateSession(sessionName, { connectionState: newState });
        await saveClientDataService.addOrUpdateDataSession(client);

        // Limpar recursos em caso de falha de autenticação
        try {
          if (client.pupPage && !client.pupPage.isClosed()) {
            await client.pupPage.close().catch(() => {});
          }
          if (client.pupBrowser && !client.pupBrowser.isConnected()) {
            await client.pupBrowser.close().catch(() => {});
          }
        } catch (cleanupError) {
          console.log(`Erro ao limpar recursos após falha de autenticação para ${sessionName}:`, cleanupError.message);
        }

        // Remover a sessão do Set de sessões em progresso
        sessionsInProgress.delete(sessionName);

        console.log(`Sessão ${sessionName} marcada como ${newState} e recursos liberados`);
      } catch (error) {
        console.error(`Erro ao processar falha de autenticação para ${sessionName}:`, error.message);

        // Garantir que a sessão seja marcada como falha mesmo em caso de erro
        try {
          sessionsManager.updateSession(sessionName, { connectionState: "auth_failure" });
          await saveClientDataService.addOrUpdateDataSession(client);
          sessionsInProgress.delete(sessionName);
        } catch (finalError) {
          console.error(`Erro final ao atualizar estado da sessão ${sessionName}:`, finalError.message);
        }
      }
    });

    client.on("connection-state-changed", async (state) => {
      console.log(`Estado da conexão mudou para sessão ${sessionName}:`);
      console.log(`Estado anterior: ${client.connectionState}`);
      console.log(`Novo estado recebido: ${state}`);
      sessionsManager.updateSession(sessionName, { connectionState: state });
      client.connectionState = state;
      console.log(`Estado atualizado no client: ${client.connectionState}`);
    });

    client.on("message", async (message) => {
      try {
        let mediaName = "";
        let mediaUrl = "";
        let mediaBase64 = "";
        let ticketId;
        let bot_idstatus;
        const redirectSentMap = new Map();

        if (client.connectionState !== "open") {
          console.log(`Sessão ${sessionName} está desconectada. Ignorando mensagem.`);
          return;
        }

        console.log(`Sessão ${sessionName} recebeu a mensagem: ${message.body} de ${message.from} no horário ${new Date()}`);

        // Busca no banco a urlWebhook e se o bot esta ativo ou nao
        const responseStatusUrlWebhook = await executeQuery(
          `SELECT webhook, ativa_bot FROM codechat_hosts ch WHERE nome='${urlWebhookMedia}'`
        );

        const { webhook, ativa_bot } = responseStatusUrlWebhook[0] || {};
        const urlWebhookResponse = webhook;

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

        // Tentar enviar os dados para o webhook
        try {
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
          bot_idstatus = ativa_bot === "N" ? 2 : statusAtendimento[0]?.bot_idstatus;

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

    try {
      await client.initialize().catch(async (error) => {
        console.error(`Erro na inicialização do cliente ${sessionName}:`, error);
        if (client.pupPage && !client.pupPage.isClosed()) {
          await client.pupPage.close().catch(() => {});
        }
        throw error;
      });

      return client;
    } catch (error) {
      console.error(`Falha na inicialização do cliente ${sessionName}:`, error);
      sessionsManager.removeSession(sessionName);
      sessionsInProgress.delete(sessionName);
      throw error;
    }
  } catch (error) {
    console.error(`Erro ao criar a sessão ${sessionName}:`, error);
    sessionsManager.removeSession(sessionName);
  }
};

module.exports = {
  createSession,
};

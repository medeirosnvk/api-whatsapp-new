const qrcode = require("qrcode-terminal");
const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { saveQRCodeImage } = require("./saveQRCodeImageService");
const saveClientDataService = require("../../services/InstanceServices/saveClientDataService");
const StateMachine = require("../../services/InstanceServices/stateMachineService");
const sessionsManager = require("../../services/sessionsManager");

const createSession = async (sessionName) => {
  const existingSession = sessionsManager.getSession(sessionName);

  if (existingSession) {
    if (existingSession.connectionState === "open") {
      console.log(`A sessão ${sessionName} já está conectada.`);
      return;
    } else {
      console.log(`A sessão ${sessionName} existe, mas não está conectada.`);
    }
  }

  let isQRFunctionExposed = false;

  try {
    console.log(`Criando nova sessão: ${sessionName}...`);

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
    sessionsManager.addSession(sessionName, client, { connectionState: "connecting" });

    const qrTimeout = setTimeout(() => {
      if (client.connectionState !== "open") {
        client.connectionState = "disconnected";
        console.log(`Tempo esgotado para a sessão ${sessionName}. Desconectando...`);
        client.destroy();
        sessionsManager.removeSession(sessionName); // Remove a sessão do sessionManager
      }
    }, 3 * 60 * 1000); // 3 minutos

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
        clearTimeout(qrTimeout);
        console.error(`Sessão ${sessionName} foi desconectada.`);

        client.connectionState = "disconnected";
        const clientData = saveClientDataService.addOrUpdateDataSession(client);
        sessionsManager.updateSession(sessionName, {
          connectionState: "disconnected",
          clientData,
        });

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
        } else {
          sessionsManager.updateSession(sessionName, { connectionState: "disconnected" });
          saveClientDataService.addOrUpdateDataSession(client);
        }
      }
    });

    client.on("auth_failure", (data) => {
      clearTimeout(qrTimeout);
      console.error(`Sessão ${sessionName} falhou na autenticação.`);

      client.connectionState = "auth_failure";
      const clientData = saveClientDataService.addOrUpdateDataSession(client);
      sessionsManager.updateSession(sessionName, {
        connectionState: "auth_failure",
        clientData,
      });

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
      try {
        clearTimeout(qrTimeout);
        console.log(`Sessão ${sessionName} está pronta!`);

        client.connectionState = "open";
        const clientData = saveClientDataService.addOrUpdateDataSession(client);
        sessionsManager.updateSession(sessionName, {
          connectionState: "open",
        });

        // Configuração da máquina de estado
        new StateMachine(client, sessionName);
      } catch (error) {
        console.error(`Erro ao configurar a sessão "${sessionName}":`, error);
        sessionsManager.removeSession(sessionName);
      }
    });

    client.on("message", async (message) => {
      try {
        console.log(`Mensagem ${message.body} recebida de ${message.from} as ${new Date()}`);

        if (message.body === "ping") {
          message.reply("pong");
        }
      } catch (error) {
        console.error("Erro ao processar com a mensagem:", error);
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

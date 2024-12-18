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
      return existingSession;
    } else {
      console.log(`A sessão ${sessionName} existe, mas não está conectada.`);
    }
  }

  let isQRFunctionExposed = false;

  try {
    console.log(`Criando nova sessão: ${sessionName}...`);

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
    }, 3 * 60 * 1000);

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

    client.on("auth_failure", (data) => {
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

    client.on("connection-state-changed", (state) => {
      console.log(`Estado da conexão mudou para ${sessionName}:`, state);
      sessionsManager.updateSession(sessionName, { connectionState: state });
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

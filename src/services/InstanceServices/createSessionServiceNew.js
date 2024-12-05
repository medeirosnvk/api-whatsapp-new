const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const sessionManager = require("../../services/sessionsManager");

const createSession = async (sessionName) => {
  const existingSession = sessionManager.getSession(sessionName);

  if (existingSession) {
    if (existingSession.connectionState === "open") {
      console.log(`A sessão ${sessionName} já está conectada.`);
      return existingSession.client;
    } else {
      console.log(`A sessão ${sessionName} existe, mas não está conectada.`);
    }
  }

  console.log(`Criando nova sessão: ${sessionName}...`);
  const localAuth = new LocalAuth({ clientId: sessionName });

  const client = new Client({
    authStrategy: localAuth,
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  // Adiciona a sessão ao sessionManager com estado inicial
  sessionManager.addSession(sessionName, client, { connectionState: "connecting" });

  // Configurando o timeout de 1 minuto
  const timeout = setTimeout(async () => {
    console.log(`A sessão ${sessionName} não foi efetivada em 1 minuto. Encerrando...`);
    client.destroy(); // Finaliza a instância do cliente
    sessionManager.removeSession(sessionName); // Remove a sessão do sessionManager
  }, 5 * 100 * 60);

  client.on("qr", (qr) => {
    console.log(`QR Code gerado para a sessão ${sessionName}:`);
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log(`Sessão ${sessionName} está pronta.`);
    sessionManager.updateSession(sessionName, { connectionState: "open" });
    clearTimeout(timeout); // Cancela o timeout
  });

  client.on("disconnected", () => {
    console.log(`Sessão ${sessionName} foi desconectada.`);
    sessionManager.updateSession(sessionName, { connectionState: "disconnected" });
  });

  client.on("auth_failure", (msg) => {
    console.log(`Falha de autenticação na sessão ${sessionName}:`, msg);
    sessionManager.updateSession(sessionName, { connectionState: "auth_failure" });
    clearTimeout(timeout); // Cancela o timeout
  });

  client.on("message", (message) => {
    console.log(`Mensagem recebida de ${message.from}:`, message.body);
  });

  await client.initialize();

  return client;
};

module.exports = {
  createSession,
};

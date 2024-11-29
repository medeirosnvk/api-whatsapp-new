require("dotenv").config();
const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fileRoutes = require("../src/routes/fileRoutes");
const instanceRoutes = require("../src/routes/instanceRoutes");
const messageRoutes = require("../src/routes/messageRoutes");
const qrCodeRoutes = require("../src/routes/qrCodeRoutes");
const { restoreAllSessions } = require("../src/services/InstanceServices/restoreAllSessionsService");

const qrCodeDataPath = path.join(__dirname, "qrcodes");
const clientDataPath = path.join(__dirname, "clientData.json");
const mediaDataPath = path.join(__dirname, "media");
const port = process.env.PORT;
const environment = process.env.NODE_ENV;

const app = express();

let sessions = {};

const initializeDirectories = () => {
  if (!fs.existsSync(qrCodeDataPath)) {
    console.log("Diretório 'qrcodes' não existe, criando...");
    fs.mkdirSync(qrCodeDataPath);
  }

  if (!fs.existsSync(mediaDataPath)) {
    console.log("Diretório 'media' não existe, criando...");
    fs.mkdirSync(mediaDataPath);
  }
};

const loadSessions = () => {
  if (fs.existsSync(clientDataPath)) {
    sessions = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));
    Object.keys(sessions).forEach((instanceName) => {
      sessions[instanceName].connectionState = "disconnected";
    });
    console.log("Diretório 'media' não existe, criando...");
    fs.writeFileSync(clientDataPath, JSON.stringify(sessions, null, 2));
  }
};

const configureErrorHandlers = () => {
  process.on("uncaughtException", (err) => {
    console.error("Exceção Não Tratada:", err);
    process.exit(1); // Encerra o processo
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Rejeição de Promessa Não Tratada:", reason);
    handleRejectionError(reason);
  });
};

const handleRejectionError = (reason) => {
  if (reason.code === "ENOTEMPTY") {
    console.error("Diretório não está vazio. Tentando nova operação...");
  } else if (reason instanceof TypeError && reason.message.includes("Cannot read properties of undefined (reading 'AppState')")) {
    console.error("Erro ao acessar propriedades indefinidas. Descartando operação...");
  } else if (reason instanceof Error && reason.message.includes("Failed to add page binding with name onQRChangedEvent")) {
    console.error("Erro: O nome 'onQRChangedEvent' já existe. Ignorando...");
  } else if (reason instanceof Error && reason.message.includes("window is not defined")) {
    console.error("Erro: O objeto 'window' não está disponível. Verifique o contexto de execução.");
  } else {
    fs.appendFileSync("error.log", `Rejeição de Promessa Não Tratada: ${reason}\n`);
  }
};

const startHttpServer = () => {
  app.listen(port, () => {
    console.log(`Servidor HTTP LOCALHOST iniciado na porta ${port}`);

    restoreAllSessions();
  });
};

const startHttpsServer = () => {
  const privateKey = fs.readFileSync("/etc/letsencrypt/live/whatsapp.cobrance.online/privkey.pem", "utf8");
  const certificate = fs.readFileSync("/etc/letsencrypt/live/whatsapp.cobrance.online/fullchain.pem", "utf8");
  const ca = fs.readFileSync("/etc/letsencrypt/live/whatsapp.cobrance.online/chain.pem", "utf8");
  const credentials = { key: privateKey, cert: certificate, ca };
  const httpsServer = https.createServer(credentials, app);

  httpsServer.listen(port, async () => {
    console.log(`Servidor HTTPS iniciado na porta ${port}`);

    restoreAllSessions();
  });
};

const startServer = () => {
  app.use(express.json());
  app.use(cors());

  app.use(instanceRoutes);
  app.use(qrCodeRoutes);
  app.use(messageRoutes);
  app.use(fileRoutes);

  if (environment === "production") {
    startHttpsServer();
  } else {
    startHttpServer();
  }
};

initializeDirectories();
loadSessions();
configureErrorHandlers();
startServer();

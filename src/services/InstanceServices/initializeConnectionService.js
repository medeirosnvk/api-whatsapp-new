/* eslint-disable quotes */
const fs = require("fs");
const sessionsManager = require("./sessionsManager");

const getConnectionStatus = (sessionName) => {
  const client = sessionsManager.getSession(sessionName);

  if (!client) {
    return "disconnected";
  }
  return client.connectionState || "unknown";
};

const initializeConnectionStatus = (clientDataPath) => {
  const sessions = sessionsManager.getAllSessions(); // Obtém todas as sessões

  Object.keys(sessions).forEach((sessionName) => {
    const state = getConnectionStatus(sessionName); // Função que obtém o estado da conexão
    sessionsManager.addOrUpdateSession(sessionName, {
      ...sessions[sessionName],
      connectionState: state, // Atualiza o estado da conexão
    });
  });

  // Salva as atualizações de volta para clientData.json
  fs.writeFileSync(
    clientDataPath,
    JSON.stringify(sessionsManager.getAllSessions(), null, 2),
    "utf8"
  );
};

module.exports = { initializeConnectionStatus };

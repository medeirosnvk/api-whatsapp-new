const fs = require("fs");
const sessionsManager = require("../../services/sessionsManager");

const getConnectionStatus = (sessionName) => {
  const session = sessionsManager.getSession(sessionName);

  if (!session.client) {
    return "disconnected";
  }
  return session.client.connectionState || "unknown";
};

const initializeConnectionStatus = (clientDataPath) => {
  const sessions = sessionsManager.getAllSessions(); // Obtém todas as sessões

  Object.keys(sessions).forEach((sessionName) => {
    const state = getConnectionStatus(sessionName); // Função que obtém o estado da conexão
    sessionsManager.updateSession(sessionName, {
      ...sessions[sessionName],
      connectionState: state, // Atualiza o estado da conexão
    });
  });

  // Salva as atualizações de volta para clientData.json
  fs.writeFileSync(clientDataPath, JSON.stringify(sessionsManager.getAllSessions(), null, 2), "utf8");
};

module.exports = { initializeConnectionStatus };

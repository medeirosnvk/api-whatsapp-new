const sessions = {};

function getAllSessions() {
  return sessions;
}

function getSession(sessionName) {
  return sessions[sessionName] || null;
}

function addSession(sessionName, client) {
  sessions[client.sessionName] = client;
  console.log(`Sessão '${sessionName}' salva com sucesso em sessionsManager.`);
}

function updateSession(sessionName, updates) {
  if (sessions[sessionName]) {
    sessions[sessionName] = {
      ...sessions[sessionName], // Mantém os dados existentes
      ...updates, // Aplica as atualizações fornecidas
    };
    console.log(`Sessão '${sessionName}' atualizada com sucesso em sessionsManager.`);
  } else {
    console.error(`A sessão '${sessionName}' não foi encontrada. Não foi possível atualizar.`);
  }
}

function deleteSession(sessionName) {
  if (sessions[sessionName]) {
    delete sessions[sessionName];
    return true;
  }
  return false;
}

module.exports = {
  getAllSessions,
  getSession,
  addSession,
  updateSession,
  deleteSession,
};

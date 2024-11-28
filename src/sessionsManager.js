const sessions = {};

function getAllSessions() {
  return sessions;
}

function getSession(sessionName) {
  return sessions[sessionName] || null;
}

function addSession(sessionName, client) {
  if (!sessions[sessionName]) {
    sessions[sessionName] = client; // Adiciona os dados do cliente diretamente
    console.log(`Sessão '${sessionName}' criada com sucesso.`);
  } else {
    console.error(`A sessão '${sessionName}' já existe. Dados atuais:`, JSON.stringify(sessions[sessionName], null, 2));
  }
}

function updateSession(sessionName, updates) {
  if (sessions[sessionName]) {
    sessions[sessionName] = {
      ...sessions[sessionName], // Mantém os dados existentes
      ...updates, // Aplica as atualizações fornecidas
    };
    console.log(`Sessão '${sessionName}' atualizada com sucesso.`);
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

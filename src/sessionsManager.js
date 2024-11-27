const sessions = {};

function getAllSessions() {
  return sessions;
}

function getSession(instanceName) {
  return sessions[instanceName] || null;
}

function addSession(instanceName, sessionData) {
  if (!sessions[instanceName]) {
    sessions[instanceName] = sessionData;
  } else {
    console.error(`A sessão '${instanceName}' já existe.`);
  }
}

function updateSession(instanceName, sessionData) {
  if (sessions[instanceName]) {
    sessions[instanceName] = {
      ...sessions[instanceName], // Mantém os dados existentes
      ...sessionData, // Atualiza com os novos dados
    };
  } else {
    console.error(`A sessão '${instanceName}' não foi encontrada.`);
  }
}

function removeSession(instanceName) {
  if (sessions[instanceName]) {
    delete sessions[instanceName];
    return true;
  }
  return false;
}

module.exports = {
  getAllSessions,
  getSession,
  addSession,
  updateSession,
  removeSession,
};

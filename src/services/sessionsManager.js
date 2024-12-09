const sessions = new Map(); // Armazena as informações das sessões

module.exports = {
  addSession: (sessionName, client, additionalData = {}) => {
    sessions.set(sessionName, {
      client,
      connectionState: "connecting", // Estado inicial
      ...additionalData,
    });
  },
  getSession: (sessionName) => {
    return sessions.get(sessionName);
  },
  getAllSessions: () => {
    return Array.from(sessions.entries()).map(([sessionName, sessionData]) => ({
      sessionName,
      ...sessionData,
    }));
  },
  updateSession: (sessionName, updates) => {
    const session = sessions.get(sessionName);
    if (!session) {
      throw new Error("Sessão não encontrada.");
    }
    sessions.set(sessionName, {
      ...session,
      ...updates, // Atualiza os dados com as novas informações
    });
  },
  removeSession: (sessionName) => {
    sessions.delete(sessionName);
  },
};

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
    try {
      if (sessions.size === 0) {
        return []; // Retorna um array vazio se não houver sessões
      }

      return Array.from(sessions.entries()).map(([sessionName, sessionData]) => ({
        sessionName,
        connectionState: sessionData.connectionState || "unknown", // Valor padrão
        ...sessionData,
      }));
    } catch (error) {
      console.error("Error retrieving all sessions:", error);
      throw new Error("Erro ao buscar sessões.");
    }
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

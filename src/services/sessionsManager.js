/* eslint-disable indent */
/* eslint-disable no-unused-vars */
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
    return Array.from(sessions.entries()).map(([sessionName, sessionData]) => {
      const { client, ...safeData } = sessionData;

      // Verifica se o client e info estão presentes
      const clientInfo = client?.info
        ? {
            pushname: client.info.pushname,
            wid: client.info.wid,
            me: client.info.me,
            phone: client.info.phone,
            platform: client.info.platform,
          }
        : null;

      // Exibe o conteúdo de client no console
      console.log(`Session "${sessionName}" client data:`, client);

      return {
        sessionName,
        connectionState: safeData.connectionState, // Retorna sessionName e connectionState
        info: clientInfo, // Inclui os dados de info, se existirem
      };
    });
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

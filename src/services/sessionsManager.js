/* eslint-disable indent */
/* eslint-disable no-unused-vars */
const sessions = new Map(); // Armazena as informações das sessões

// Utilitário para obter o horário do servidor com fuso horário
const getServerDateTime = (timezone = "America/Sao_Paulo") => {
  return new Date().toLocaleString("en-US", { timeZone: timezone });
};

module.exports = {
  /**
   * Adiciona uma nova sessão ao gerenciador.
   * @param {string} sessionName - Nome da sessão.
   * @param {object} client - Objeto do cliente WhatsApp.
   * @param {object} additionalData - Dados adicionais para a sessão.
   */
  addSession: (sessionName, client, additionalData = {}) => {
    sessions.set(sessionName, {
      client,
      connectionState: "connecting", // Estado inicial
      connectionDateTime: getServerDateTime(),
      ...additionalData,
    });
  },

  /**
   * Retorna os dados de uma sessão pelo nome.
   * @param {string} sessionName - Nome da sessão.
   * @returns {object|null} - Dados da sessão ou null se não encontrada.
   */
  getSession: (sessionName) => {
    if (!sessions.has(sessionName)) {
      console.warn(`Sessão "${sessionName}" não encontrada.`);
      return null;
    }
    return sessions.get(sessionName);
  },

  /**
   * Retorna todas as sessões armazenadas no gerenciador.
   * @returns {Array} - Lista de todas as sessões com dados relevantes.
   */
  getAllSessions: () => {
    return Array.from(sessions.entries()).map(([sessionName, sessionData]) => {
      const { client, ...safeData } = sessionData;

      // Verifica se o client e info estão presentes
      const clientInfo = client?.info
        ? {
            pushname: client.info.pushname,
            wid: client.info.wid,
          }
        : null;

      return {
        sessionName,
        connectionState: client.connectionState, // Retorna sessionName e connectionState
        info: clientInfo, // Inclui os dados de info, se existirem
        connectionDateTime: client.connectionDateTime,
      };
    });
  },

  /**
   * Atualiza os dados de uma sessão existente.
   * @param {string} sessionName - Nome da sessão.
   * @param {object} updates - Dados a serem atualizados.
   * @throws {Error} - Se a sessão não for encontrada.
   */
  updateSession: (sessionName, updates) => {
    const session = sessions.get(sessionName);

    if (!session) {
      throw new Error(`Sessão "${sessionName}" não encontrada.`);
    }

    if (updates.client) {
      console.warn("Atualização do objeto `client` ignorada para evitar sobrescrita indesejada.");
      delete updates.client; // Evita sobrescrever o cliente
    }

    sessions.set(sessionName, {
      ...session,
      ...updates, // Atualiza os dados com as novas informações
      connectionDateTime: getServerDateTime(),
    });
  },

  /**
   * Remove uma sessão do gerenciador.
   * @param {string} sessionName - Nome da sessão.
   */
  removeSession: (sessionName) => {
    if (!sessions.has(sessionName)) {
      console.warn(`Tentativa de remover sessão inexistente: "${sessionName}".`);
      return;
    }
    sessions.delete(sessionName);
  },
};

/* eslint-disable quotes */
const fs = require("fs");
const { pathExists } = require("fs-extra");
const { createSession } = require("./createSessionService");

const restoreAllSessions = async () => {
  const authDir = pathExists.join(__dirname, "../.wwebjs_auth");
  console.log("Diretório de autenticação:", authDir);

  if (fs.existsSync(authDir)) {
    const sessionFolders = fs.readdirSync(authDir);
    console.log("Pastas de sessão encontradas:", sessionFolders);

    sessionFolders.forEach(async (sessionFolder) => {
      const sessionName = sessionFolder.replace("session-", "");

      try {
        console.log(`Restaurando sessão de ${sessionName}...`);
        await createSession(sessionName);
      } catch (error) {
        console.error(`Erro ao tentar reconectar a instancia ${sessionName}: ${error.message}`);
      }
    });
  } else {
    console.error(`O diretório ${authDir} não existe.`);
  }
};

module.exports = { restoreAllSessions };

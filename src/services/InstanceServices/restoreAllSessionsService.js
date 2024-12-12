const fs = require("fs");
const path = require("path"); // Certifique-se de importar o módulo 'path'
const { createSession } = require("./createSessionService");

const authDir = path.join(__dirname, "../../../.wwebjs_auth"); // Subindo 2 níveis até a raiz

const restoreAllSessions = async () => {
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

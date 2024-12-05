const fs = require("fs");
const path = require("path");
const { disconnectSession } = require("./disconnectSessionService");

const authDir = path.join(__dirname, "../../../.wwebjs_auth"); // Subindo 2 níveis até a raiz

const disconnectAllSessions = async () => {
  try {
    const files = fs.readdirSync(authDir);
    const sessionDirs = files.filter((file) => fs.lstatSync(path.join(authDir, file)).isDirectory() && file.startsWith("session-"));

    for (const dir of sessionDirs) {
      const sessionName = dir.substring("session-".length); // Remove o prefixo "session-"
      await disconnectSession(sessionName);
    }
  } catch (error) {
    console.error("Erro ao ler o diretório de sessões:", error);
    throw error;
  }
};

module.exports = { disconnectAllSessions };

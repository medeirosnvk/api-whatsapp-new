const fs = require("fs");
const path = require("path");
const { disconnectSession } = require("./disconnectSessionService");

const disconnectAllSessions = async () => {
  const sessionsPath = path.join(__dirname, "../.wwebjs_auth");

  try {
    const files = fs.readdirSync(sessionsPath);
    const sessionDirs = files.filter((file) => fs.lstatSync(path.join(sessionsPath, file)).isDirectory() && file.startsWith("session-"));

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

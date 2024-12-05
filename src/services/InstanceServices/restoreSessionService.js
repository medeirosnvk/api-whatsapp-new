const fs = require("fs");
const path = require("path");

const { createSession } = require("./createSessionService");

const restoreSession = async (sessionName) => {
  const sessionFolder = `session-${sessionName}`;
  const sessionPath = path.join(__dirname, "../../../.wwebjs_auth", sessionFolder);

  if (fs.existsSync(sessionPath)) {
    try {
      console.log(`Restaurando sessão de ${sessionName}...`);
      await createSession(sessionName);
    } catch (error) {
      console.error(`Erro ao tentar reconectar a instancia ${sessionName}: ${error.message}`);
    }
  } else {
    console.error(`O diretório ${sessionPath} não existe.`);
  }
};

module.exports = { restoreSession };

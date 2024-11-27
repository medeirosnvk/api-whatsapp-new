const restoreSession = (sessionName) => {
  const sessionFolder = `session-${sessionName}`;
  const sessionPath = path.join(__dirname, "../.wwebjs_auth", sessionFolder);

  if (fs.existsSync(sessionPath)) {
    try {
      console.log(`Restaurando sessão de ${sessionName}...`);
      createSession(sessionName);
    } catch (error) {
      console.error(
        `Erro ao tentar reconectar a instancia ${sessionName}: ${error.message}`
      );
    }
  } else {
    console.error(`O diretório ${sessionPath} não existe.`);
  }
};

module.exports = { restoreSession };

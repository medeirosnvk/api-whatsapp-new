const deleteSession = (sessionName) => {
  const clientDataFilePath = path.join(__dirname, "clientData.json");
  let clientData = {};

  // Tente ler o arquivo existente
  try {
    if (fs.existsSync(clientDataFilePath)) {
      const fileContent = fs.readFileSync(clientDataFilePath, "utf-8");
      clientData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao ler o arquivo de dados do cliente:", error);
    return { error: "Erro ao ler o arquivo de dados do cliente." };
  }

  // Verifica se a sessão existe e está desconectada
  if (
    clientData[sessionName] &&
    clientData[sessionName].connectionState === "disconnected"
  ) {
    const sessionDirPath = path.join(sessionDataPath, `session-${sessionName}`);

    // Remove o diretório da sessão
    try {
      if (fs.existsSync(sessionDirPath)) {
        fs.rmSync(sessionDirPath, { recursive: true, force: true });
        console.log(`Diretório da sessão ${sessionName} removido com sucesso.`);
      }
    } catch (error) {
      console.error(
        `Erro ao remover o diretório da sessão ${sessionName}:`,
        error
      );
      return {
        error: `Erro ao remover o diretório da sessão ${sessionName}.`,
      };
    }

    // Remove os dados da sessão do arquivo JSON
    delete clientData[sessionName];

    // Atualiza o arquivo JSON
    try {
      fs.writeFileSync(clientDataFilePath, JSON.stringify(clientData, null, 2));
      console.log("Dados das sessões atualizados no arquivo JSON.");
    } catch (error) {
      console.error("Erro ao salvar os dados do cliente:", error);
      return { error: "Erro ao salvar os dados do cliente." };
    }

    return { success: `Sessão ${sessionName} removida com sucesso.` };
  } else {
    return { error: "Sessão não encontrada ou não está desconectada." };
  }
};

module.exports = { deleteSession };

const sessionsManager = require("../../services/sessionsManager");
const fs = require("fs");
const path = require("path");
const StateMachine = require("../../services/InstanceServices/stateMachineService");

const clientDataFile = path.join(__dirname, "../../../clientData.json");

const disconnectSession = async (sessionName) => {
  const session = sessionsManager.getSession(sessionName);

  if (session.client && session.client.info) {
    console.log(`Cliente ${sessionName} está ativo e pronto para logout.`);
  } else {
    console.log(`Cliente ${sessionName} não está inicializado ou já foi destruído.`);
  }

  if (session.client) {
    try {
      try {
        // Tente realizar o logout
        await session.client.logout();
        console.log(`Logout da sessão ${sessionName} realizado com sucesso.`);
      } catch (logoutError) {
        // Se o logout falhar, registrar o erro, mas continuar o processo
        console.error(`Erro ao realizar logout da sessão ${sessionName}. Prosseguindo com a limpeza...`, logoutError);
      }

      const sessionPath = path.join(__dirname, "../.wwebjs_auth", `session-${sessionName}`);

      // Função para excluir a pasta da sessão
      const deleteFolderRecursive = (folderPath) => {
        if (fs.existsSync(folderPath)) {
          fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              // Recursivamente exclui pastas
              deleteFolderRecursive(curPath);
            } else {
              // Exclui arquivos
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(folderPath);
          console.log(`Diretório de autenticação da sessão ${sessionName} excluído com sucesso!`);
        }
      };

      // Excluir a pasta da sessão
      deleteFolderRecursive(sessionPath);

      // Destruir o cliente e remover a sessão da memória
      await session.client.destroy();
      sessionsManager.deleteSession(sessionName);

      StateMachine.deleteStateMachine(sessionName);
      console.log(`Sessão ${sessionName} removida da memória com sucesso.`);

      // Remover a sessão do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataFile, "utf8"));
      delete clientData[sessionName];
      fs.writeFileSync(clientDataFile, JSON.stringify(clientData, null, 2));
      console.log(`Sessão ${sessionName} removida do clientData.json.`);
    } catch (error) {
      console.error(`Erro ao desconectar a sessão ${sessionName}:`, error);
      throw error;
    }
  } else {
    console.log(`Sessão ${sessionName} não encontrada.`);
  }
};

module.exports = { disconnectSession };

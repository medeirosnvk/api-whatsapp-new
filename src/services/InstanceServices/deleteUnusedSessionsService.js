const sessionsManager = require("../../services/sessionsManager");

const path = require("path");
const fs = require("fs");

const clientDataFile = path.join(__dirname, "../../../clientData.json");

const deleteUnusedSessions = async () => {
  let clientData = {};

  // Função para excluir a pasta da sessão
  const deleteFolderRecursive = (folderPath, sessionName) => {
    if (fs.existsSync(folderPath)) {
      fs.readdirSync(folderPath).forEach((file) => {
        const curPath = path.join(folderPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // Recursivamente exclui pastas
          deleteFolderRecursive(curPath, sessionName);
        } else {
          // Exclui arquivos
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(folderPath);
      console.log(`Diretório de autenticação da sessão ${sessionName} excluído com sucesso!`);
    }
  };

  // Tente ler o arquivo existente
  try {
    if (fs.existsSync(clientDataFile)) {
      console.log("Arquivo clientData.json encontrado e lido corretamente.");
      const fileContent = fs.readFileSync(clientDataFile, "utf-8");
      clientData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao ler o arquivo clientData.json:", error);
    return;
  }

  // Filtra as sessões desconectadas e remove os diretórios e dados correspondentes
  for (const sessionName of Object.keys(clientData)) {
    if (clientData[sessionName].connectionState !== "open") {
      const sessionPath = path.join(__dirname, "../../../.wwebjs_auth", `session-${sessionName}`);

      // Remove o diretório da sessão usando deleteFolderRecursive
      deleteFolderRecursive(sessionPath, sessionName);

      // Remove os dados da sessão do arquivo JSON
      delete clientData[sessionName];
    }
  }

  // Verifica por diretórios de sessões que não estão em clientData e os remove
  try {
    const sessionDirs = fs.readdirSync(path.join(__dirname, "../../../.wwebjs_auth"));
    for (const dir of sessionDirs) {
      if (dir.startsWith("session-")) {
        const sessionName = dir.replace("session-", "");
        const sessionDirPath = path.join(__dirname, "../../../.wwebjs_auth", dir);

        // Verifica se a sessão não existe no clientData e remove o diretório se necessário
        if (!clientData[sessionName] && fs.lstatSync(sessionDirPath).isDirectory()) {
          deleteFolderRecursive(sessionDirPath, sessionName);
          sessionsManager.removeSession(sessionName);
        }
      }
    }
  } catch (error) {
    console.error("Erro ao listar diretórios de sessões:", error);
  }

  // Atualiza o arquivo JSON
  try {
    fs.writeFileSync(clientDataFile, JSON.stringify(clientData, null, 2));
    console.log("Dados das sessões atualizados no arquivo JSON.");
  } catch (error) {
    console.error("Erro ao salvar os dados do cliente:", error);
  }
};

module.exports = { deleteUnusedSessions };

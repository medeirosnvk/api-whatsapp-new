/* eslint-disable quotes */
const fs = require("fs");
const path = require("path");

let clientData = {};
const filePath = path.join(__dirname, "clientData.json");

const saveClientData = (client) => {
  // Tente ler o arquivo existente
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      clientData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao ler o arquivo de dados do cliente:", error);
  }

  const serverTimezone = "America/Sao_Paulo"; // Substitua pelo fuso horário do seu servidor
  const serverDateTime = new Date().toLocaleString("en-US", {
    timeZone: serverTimezone,
  });

  // Verifique se client.info e client.info.wid estão definidos
  const userId = client.info && client.info.wid ? client.info.wid.user : null;

  // Atualize os dados com a nova conexão
  clientData[client.sessionName] = {
    lastLoggedOut: client.lastLoggedOut,
    connectionState: client.connectionState,
    sessionName: client.sessionName,
    wid: {
      user: userId, // Acessando user dentro de info, agora com verificação
    },
    connectionDateTime: serverDateTime,
  };

  // Escreva os dados atualizados de volta ao arquivo
  try {
    fs.writeFileSync(filePath, JSON.stringify(clientData, null, 2));
    console.log(`Dados da sessão ${client.sessionName} salvos em ${filePath}`);
  } catch (error) {
    console.error("Erro ao salvar os dados do cliente:", error);
  }
};

module.exports = { saveClientData };

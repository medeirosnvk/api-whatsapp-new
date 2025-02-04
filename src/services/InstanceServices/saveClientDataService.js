const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../../clientData.json");

const loadClientData = () => {
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      console.log("Arquivo clientData.json encontrado e lido corretamente.");
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao carregar dados do cliente:", error);
  }
  return {}; // Retorna um objeto vazio se o arquivo não existir ou houver erro
};

const saveClientData = (clientData) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(clientData, null, 2), "utf8");
    console.log("Dados salvos com sucesso em clientData.json.");
  } catch (error) {
    console.error("Erro ao salvar os dados do cliente:", error);
  }
};

const addOrUpdateDataSession = (client) => {
  const clientData = loadClientData();

  const serverTimezone = "America/Sao_Paulo"; // Substitua pelo fuso horário do seu servidor
  const serverDateTime = new Date().toLocaleString("en-US", {
    timeZone: serverTimezone,
  });

  const userId = client.info && client.info.wid ? client.info.wid.user : null;

  if (!client.sessionName) {
    console.error("Erro: 'sessionName' está indefinido no objeto client:", client);
    return;
  }

  clientData[client.sessionName] = {
    sessionName: client.sessionName,
    connectionState: client.connectionState || "unknown",
    wid: {
      user: userId,
    },
    connectionDateTime: serverDateTime,
    lastLoggedOut: client.lastLoggedOut || null,
  };

  saveClientData(clientData);
};

const deleteDataSession = (sessionName) => {
  const clientData = loadClientData();

  if (clientData[sessionName]) {
    delete clientData[sessionName];
    console.log(`Sessão '${sessionName}' excluída.`);
    saveClientData(clientData);
  } else {
    console.error(`Sessão '${sessionName}' não encontrada.`);
  }
};

const getDataSession = (sessionName) => {
  const clientData = loadClientData();
  return clientData[sessionName] || null;
};

const listDataSessions = () => {
  const clientData = loadClientData();
  return Object.keys(clientData);
};

module.exports = {
  addOrUpdateDataSession,
  deleteDataSession,
  getDataSession,
  listDataSessions,
};

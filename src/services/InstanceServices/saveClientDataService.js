// /* eslint-disable quotes */
// const fs = require("fs");
// const path = require("path");

// let clientData = {};
// const filePath = path.join(__dirname, "clientData.json");

// const saveClientData = (client) => {
//   // Tente ler o arquivo existente
//   try {
//     if (fs.existsSync(filePath)) {
//       const fileContent = fs.readFileSync(filePath, "utf-8");
//       clientData = JSON.parse(fileContent);
//     }
//   } catch (error) {
//     console.error("Erro ao ler o arquivo de dados do cliente:", error);
//   }

//   const serverTimezone = "America/Sao_Paulo"; // Substitua pelo fuso horário do seu servidor
//   const serverDateTime = new Date().toLocaleString("en-US", {
//     timeZone: serverTimezone,
//   });

//   // Verifique se client.info e client.info.wid estão definidos
//   const userId = client.info && client.info.wid ? client.info.wid.user : null;

//   // Atualize os dados com a nova conexão
//   clientData[client.sessionName] = {
//     lastLoggedOut: client.lastLoggedOut,
//     connectionState: client.connectionState,
//     sessionName: client.sessionName,
//     wid: {
//       user: userId, // Acessando user dentro de info, agora com verificação
//     },
//     connectionDateTime: serverDateTime,
//   };

//   // Escreva os dados atualizados de volta ao arquivo
//   try {
//     fs.writeFileSync(filePath, JSON.stringify(clientData, null, 2));
//     console.log(`Dados da sessão ${client.sessionName} salvos em ${filePath}`);
//   } catch (error) {
//     console.error("Erro ao salvar os dados do cliente:", error);
//   }
// };

// module.exports = { saveClientData };

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../../clientData.json");

// Função para remover referências circulares durante a serialização
function removeCircularReferences(key, value) {
  if (key === "client") {
    return undefined; // Remove qualquer propriedade de 'client' que possa ser circular
  }
  return value; // Deixa as outras propriedades como estão
}

// Função para carregar os dados do arquivo
const loadClientData = () => {
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao carregar dados do cliente:", error);
  }
  return {}; // Retorna um objeto vazio se o arquivo não existir ou houver erro
};

// Função para salvar os dados no arquivo
const saveClientData = (clientData) => {
  const sanitizedData = JSON.stringify(clientData, removeCircularReferences);

  // Agora você pode salvar o clientData sanitizado sem referências circulares
  fs.promises
    .writeFile("clientData.json", sanitizedData, "utf8")
    .then(() => {
      console.log("Dados salvos com sucesso!");
    })
    .catch((err) => {
      console.error("Erro ao salvar os dados do cliente:", err);
    });
};

// Função para adicionar ou atualizar uma sessão
const addOrUpdateDataSession = (client) => {
  const clientData = loadClientData();

  const serverTimezone = "America/Sao_Paulo"; // Substitua pelo fuso horário do seu servidor
  const serverDateTime = new Date().toLocaleString("en-US", {
    timeZone: serverTimezone,
  });

  const userId = client.info && client.info.wid ? client.info.wid.user : null;

  clientData[client.sessionName] = {
    lastLoggedOut: client.lastLoggedOut || null,
    connectionState: client.connectionState || "unknown",
    sessionName: client.sessionName,
    wid: {
      user: userId,
    },
    connectionDateTime: serverDateTime,
  };

  saveClientData(clientData);
};

// Função para excluir uma sessão
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

// Função para obter uma sessão específica
const getDataSession = (sessionName) => {
  const clientData = loadClientData();
  return clientData[sessionName] || null;
};

// Função para listar todas as sessões
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

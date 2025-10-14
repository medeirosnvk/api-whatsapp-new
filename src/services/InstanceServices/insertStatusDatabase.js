require("dotenv").config();

const { executeQuery } = require("../../db/dbconfig");

const insertStatusDatabase = async (nome, status, host) => {
  try {
    const query = `
      INSERT ignore INTO codechat_instancias (nome, status, host) VALUES('${nome}', 'OPEN', '${host}')
    `;
    await executeQuery(query);
    console.log(`Status da sessão ${nome} atualizado para ${status} no banco de dados.`);
  } catch (error) {
    console.error(`Erro ao atualizar o status da sessão ${nome} no banco de dados:`, error);
  }
};

const listHostsConnections = async () => {
  try {
    const query = `
      SELECT * FROM codechat_hosts ch WHERE ativo = 'S'
    `;
    const result = await executeQuery(query);
    const hosts = result.map((row) => row.host);
    console.log("Hosts ativos:", hosts);
    return hosts;
  } catch (error) {
    console.error(`Erro ao listar conexoes open no banco de dados:`, error);
  }
};

module.exports = {
  insertStatusDatabase,
  listHostsConnections,
};

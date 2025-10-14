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

module.exports = {
  insertStatusDatabase,
};

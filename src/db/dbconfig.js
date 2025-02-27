const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");
require("dotenv").config();

const defaultDbConfig = {
  host: process.env.DB_MY_SQL_HOST,
  user: process.env.MY_SQL_USER,
  password: process.env.DB_MY_SQL_PASSWORD,
  port: parseInt(process.env.MY_SQL_PORT, 10),
  database: process.env.DB_MY_SQL_DATABASE,
  connectionLimit: parseInt(process.env.MY_SQL_CONNECTION_LIMIT, 10),
  charset: process.env.MY_SQL_CHARSET,
};

const createBrowserInstance = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox"],
      executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
      ignoreDefaultArgs: ["--disable-extensions"],
    });
    return browser;
  } catch (error) {
    console.error("Erro ao iniciar o navegador:", error);
    throw error;
  }
};

const createConnection = async (dbConfig) => {
  try {
    const connection = await mysql.createConnection({
      ...dbConfig,
      connectTimeout: 60000,
    });
    return connection;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.error("Erro: Banco de dados inacessível. Verifique se ele está online.");
    } else if (error.code === "ENOTFOUND") {
      console.error("Erro: Falha na conexão. Verifique sua internet ou as configurações do banco.");
    } else {
      console.error("Erro ao conectar ao banco de dados:", error);
    }
    throw error;
  }
};

const executeQuery = async (sql, customDbConfig = defaultDbConfig) => {
  let connection;

  try {
    connection = await createConnection(customDbConfig);
    const [rows, fields] = await connection.execute(sql);
    return rows;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.error("Erro: O banco de dados está fora do ar.");
    } else if (error.code === "ENOTFOUND") {
      console.error("Erro: Sem conexão com a internet ou banco de dados não encontrado.");
    } else {
      console.error("Erro ao executar a consulta:", error);
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error("Erro ao encerrar a conexão com o banco de dados:", error);
      }
    }
  }
};

module.exports = {
  createBrowserInstance,
  executeQuery,
};

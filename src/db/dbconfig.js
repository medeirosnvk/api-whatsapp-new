const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");
require("dotenv").config();

const defaultDbConfig = {
  host: process.env.DB1_MY_SQL_HOST || "localhost",
  user: process.env.MY_SQL_USER || "root",
  password: process.env.DB1_MY_SQL_PASSWORD || "",
  port: parseInt(process.env.MY_SQL_PORT, 10) || 3306,
  database: process.env.DB1_MY_SQL_DATABASE || "test",
  connectionLimit: parseInt(process.env.MY_SQL_CONNECTION_LIMIT, 10) || 10,
  charset: process.env.MY_SQL_CHARSET || "utf8mb4",
};

const createBrowserInstance = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false, // Defina como true se não precisar da interface gráfica
      args: ["--no-sandbox"],
      executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium-browser", // Utilize variável de ambiente
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
    console.error("Erro ao conectar ao banco de dados:", error);
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
    console.error("Erro ao executar a consulta:", error);
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

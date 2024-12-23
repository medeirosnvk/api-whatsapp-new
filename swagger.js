require("dotenv").config();
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const urlWebhookMedia = process.env.URL_WEBHOOK_MEDIA;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Whatsapp Cobrance",
      version: "1.0.0",
      description: "Documentação da API Whatsapp Cobrance",
    },
    schemes: ["http"],
    host: "${urlWebhookMedia}",
    basePath: "/",
    servers: [
      {
        description: "MAQUINA102 3030",
        url: "http://10.0.0.102:3030",
      },
      {
        description: "MAQUINA102 3040",
        url: "http://10.0.0.102:3040",
      },
      {
        description: "MAQUINA102 3050",
        url: "http://10.0.0.102:3050",
      },
      {
        description: "KINGHOST 3060",
        url: `http://191.252.214.9:3060`,
      },
      {
        description: "HOSTINGER 3060",
        url: "https://whatsapp.cobrance.online:3060",
      },
      {
        description: "HOSTINGER 3080",
        url: "http://191.101.70.186:3080",
      },
      {
        description: "LOCALHOST 3000",
        url: "http://localhost:3000",
      },
    ],
  },
  apis: ["./src/routes/fileRoutes.js", "./src/routes/instanceRoutes.js", "./src/routes/messageRoutes.js", "./src/routes/qrCodeRoutes.js"],
};

const swaggerSpec = swaggerJsdoc(options);

function basicAuth(req, res, next) {
  const auth = { login: "cobrance", password: "c0br4nc3" }; // Login e senha definidos

  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="401"'); // Mostra prompt de login
  res.status(401).send("Autenticação necessária."); // Erro de autenticação
}

function setupSwagger(app) {
  app.use("/api-docs", basicAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = { setupSwagger };

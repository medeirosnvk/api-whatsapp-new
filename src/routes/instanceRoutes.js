const { createSession } = require("../services/InstanceServices/createSessionService");
const { disconnectSession } = require("../services/InstanceServices/disconnectSessionService");
const { restoreAllSessions } = require("../services/InstanceServices/restoreAllSessionsService");
const { restoreSession } = require("../services/InstanceServices/restoreSessionService");

const app = express();

app.post("/instance/create", (req, res) => {
  const { instanceName } = req.body;

  const qrCodeFilePath = path.join(qrCodeDataPath, `qrcode_${instanceName}.png`);

  if (!instanceName) {
    return res.status(400).json({ error: "instanceName is required" });
  }

  if (sessions[instanceName]) {
    console.log(`Session ${instanceName} already exists`);
    return res.status(400).json({ error: `Session ${instanceName} already exists` });
  }

  if (fs.existsSync(qrCodeFilePath)) {
    console.log(`QR Code image for session ${instanceName} already exists`);
  }

  console.log("Creating a new session...");

  try {
    createSession(instanceName);
    res.status(201).json({
      instance: {
        instanceName,
        status: "created",
      },
    });
  } catch (error) {
    res.status(500).json({
      error: `Error creating session: ${error.message}`,
    });
  }
});

app.post("/instance/restore/:sessionName", (req, res) => {
  const { sessionName } = req.params;

  if (!sessionName) {
    return res.status(400).send("sessionName is required");
  }

  try {
    restoreSession(sessionName);
    res.json({
      success: true,
      message: `Session ${sessionName} restored successfully`,
    });
  } catch (error) {
    res.status(403).json({
      error: `Error restoring session: ${error.message}`,
    });
  }
});

app.post("/instance/restoreAll", (req, res) => {
  try {
    restoreAllSessions();

    res.json({
      success: true,
      message: "Todas as sessões foram restauradas com sucesso",
    });
  } catch (error) {
    res.status(403).json({
      error: `Erro ao restaurar todas as sessões: ${error.message}`,
    });
  }
});

app.delete("/instance/logout/:sessionName", async (req, res) => {
  const { sessionName } = req.params;

  if (!sessionName) {
    return res.status(400).send("sessionName is required");
  }

  try {
    await disconnectSession(sessionName);

    res.json({
      success: true,
      message: `Session ${sessionName} disconnected successfully`,
    });
  } catch (error) {
    res.status(500).json({
      error: `Error disconnecting session: ${error.message}`,
    });
  }
});

app.delete("/instance/logoutAll", async (req, res) => {
  try {
    await disconnectAllSessions();
    res.json({
      success: true,
      message: "All sessions disconnected successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: `Error disconnecting all sessions: ${error.message}`,
    });
  }
});

app.delete("/instance/deleteSession/:sessionName", (req, res) => {
  const sessionName = req.params.sessionName;

  try {
    const result = deleteSession(sessionName);
    if (result.success) {
      res.status(200).json(result.success);
    } else {
      res.status(404).json(result.error);
    }
  } catch (error) {
    console.error("Erro ao tentar excluir a sessão:", error);
    res.status(500).json("Erro ao tentar excluir a sessão.");
  }
});

app.delete("/instance/clearUnusedSessions", (req, res) => {
  try {
    deleteUnusedSessions();
    res.status(200).json("Sessões não utilizadas foram removidas com sucesso.");
  } catch (error) {
    console.error("Erro ao limpar sessões não utilizadas:", error);
    res.status(500).json("Erro ao limpar sessões não utilizadas.");
  }
});

app.get("/instance/listFolders", (req, res) => {
  const authDir = path.join(__dirname, "../.wwebjs_auth"); // Ajuste no caminho para a pasta raiz
  console.log("Diretório de autenticação:", authDir); // Adicionado para depuração

  if (fs.existsSync(authDir)) {
    const sessionFolders = fs.readdirSync(authDir);
    const instanceNames = sessionFolders.map((sessionFolder) => sessionFolder.replace("session-", ""));
    console.log({ instances: instanceNames });
    res.json({ instances: instanceNames });
  } else {
    res.json({ instances: [] });
  }
});

app.get("/instance/fetchInstances", (req, res) => {
  const clientDataPath = path.join(__dirname, "clientData.json"); // Caminho para o arquivo clientData.json

  // Verificar se o arquivo clientData.json existe
  if (fs.existsSync(clientDataPath)) {
    try {
      // Leitura do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));

      // Extrair informações para cada instância com connectionState: 'open'
      const instances = Object.keys(clientData)
        .filter((key) => clientData[key].connectionState === "open")
        .map((key) => ({
          instance: {
            instanceName: clientData[key].sessionName,
            owner: clientData[key].wid.user,
            // state: clientData[key].connectionState,
          },
        }));

      console.log({ instances });
      res.json(instances); // Enviar resposta JSON com as instâncias encontradas
    } catch (error) {
      console.error("Erro ao ler ou analisar o arquivo clientData.json:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  } else {
    console.log("Arquivo clientData.json não encontrado em:", clientDataPath);
    res.status(404).json([]); // Se o arquivo não existe, retornar um array vazio
  }
});

app.get("/instance/fetchAllInstances", (req, res) => {
  const clientDataPath = path.join(__dirname, "clientData.json"); // Caminho para o arquivo clientData.json

  // Verificar se o arquivo clientData.json existe
  if (fs.existsSync(clientDataPath)) {
    try {
      // Leitura do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));

      // Extrair informações para cada instância com connectionState: 'open'
      const instances = Object.keys(clientData).map((key) => ({
        instance: {
          sessionName: clientData[key].sessionName,
          lastLoggedOut: clientData[key].lastLoggedOut,
          connectionState: clientData[key].connectionState,
          wid: {
            user: clientData[key].wid.user,
          },
          connectionDateTime: clientData[key].connectionDateTime,
        },
      }));

      console.log({ instances });
      res.json(instances); // Enviar resposta JSON com as instâncias encontradas
    } catch (error) {
      console.error("Erro ao ler ou analisar o arquivo clientData.json:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  } else {
    console.log("Arquivo clientData.json não encontrado em:", clientDataPath);
    res.status(404).json([]); // Se o arquivo não existe, retornar um array vazio
  }
});

app.get("/instance/connectionState/:instanceName", (req, res) => {
  const { instanceName } = req.params;
  const state = getConnectionStatus(instanceName);
  res.json({ instanceName, state });
});

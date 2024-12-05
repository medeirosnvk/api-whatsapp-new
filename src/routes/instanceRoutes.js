const express = require("express");
const fs = require("fs");
const path = require("path");

const { createSession } = require("../services/InstanceServices/createSessionService");
const { disconnectSession } = require("../services/InstanceServices/disconnectSessionService");
const { disconnectAllSessions } = require("../services/InstanceServices/disconnectAllSessionsService");
const { restoreAllSessions } = require("../services/InstanceServices/restoreAllSessionsService");
const { restoreSession } = require("../services/InstanceServices/restoreSessionService");
const { deleteSession } = require("../services/InstanceServices/deleteSessionService");
const { deleteUnusedSessions } = require("../services/InstanceServices/deleteUnusedSessionsService");
const sessionsManager = require("../services/sessionsManager");

const instanceRoutes = express.Router();

const authDir = path.join(__dirname, "../../.wwebjs_auth");
const clientDataDir = path.join(__dirname, "../../clientData.json");

instanceRoutes.post("/instance/create", async (req, res) => {
  const { instanceName } = req.body;

  try {
    await createSession(instanceName);
    res.status(200).json({ message: `Sessão ${instanceName} criada com sucesso.` });
  } catch (error) {
    console.error("Erro ao criar sessão:", error.message);
    res.status(500).json({ error: error.message });
  }
});

instanceRoutes.post("/instance/restore/:sessionName", async (req, res) => {
  const { sessionName } = req.params;

  if (!sessionName) {
    return res.status(400).send("sessionName is required");
  }

  try {
    await restoreSession(sessionName);
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

instanceRoutes.post("/instance/restoreAll", async (req, res) => {
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

instanceRoutes.delete("/instance/logout/:sessionName", async (req, res) => {
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

instanceRoutes.delete("/instance/logoutAll", async (req, res) => {
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

instanceRoutes.delete("/instance/deleteSession/:sessionName", async (req, res) => {
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

instanceRoutes.delete("/instance/clearUnusedSessions", async (req, res) => {
  try {
    deleteUnusedSessions();
    res.status(200).json("Sessões não utilizadas foram removidas com sucesso.");
  } catch (error) {
    console.error("Erro ao limpar sessões não utilizadas:", error);
    res.status(500).json("Erro ao limpar sessões não utilizadas.");
  }
});

instanceRoutes.get("/instance/listFolders", async (req, res) => {
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

instanceRoutes.get("/instance/fetchInstances", async (req, res) => {
  // Verificar se o arquivo clientData.json existe
  if (fs.existsSync(clientDataDir)) {
    try {
      // Leitura do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataDir, "utf8"));

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
    console.log("Arquivo clientData.json não encontrado em:", clientDataDir);
    res.status(404).json([]); // Se o arquivo não existe, retornar um array vazio
  }
});

instanceRoutes.get("/instance/fetchAllInstances", async (req, res) => {
  // Verificar se o arquivo clientData.json existe
  if (fs.existsSync(clientDataDir)) {
    try {
      // Leitura do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataDir, "utf8"));

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
    console.log("Arquivo clientData.json não encontrado em:", clientDataDir);
    res.status(404).json([]); // Se o arquivo não existe, retornar um array vazio
  }
});

instanceRoutes.get("/instance/connectionState/:instanceName", async (req, res) => {
  const { instanceName } = req.params;

  const session = sessionsManager.getSession(instanceName);

  if (session) {
    res.json({
      instanceName,
      state: session.connectionState || "unknown", // Valor padrão caso não exista connectionState
    });
  } else {
    res.status(404).json({
      error: "Instance not found",
      instanceName,
    });
  }
});

module.exports = instanceRoutes;

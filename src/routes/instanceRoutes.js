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

/**
 * @swagger
 * /instance/create:
 *   post:
 *     summary: Cria uma nova sessão.
 *     tags: [Instance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceName:
 *                 type: string
 *                 description: Nome da sessão a ser criada.
 *                 example: myInstance
 *     responses:
 *       200:
 *         description: Sessão criada com sucesso.
 *       500:
 *         description: Erro ao criar a sessão.
 */
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

/**
 * @swagger
 * /instance/restore/{sessionName}:
 *   post:
 *     summary: Restaura uma sessão específica.
 *     tags: [Instance]
 *     parameters:
 *       - in: path
 *         name: sessionName
 *         required: true
 *         description: Nome da sessão a ser restaurada.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sessão restaurada com sucesso.
 *       400:
 *         description: Nome da sessão é obrigatório.
 *       403:
 *         description: Erro ao restaurar a sessão.
 */
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

/**
 * @swagger
 * /instance/restoreAll:
 *   post:
 *     summary: Restaura todas as sessões.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Todas as sessões foram restauradas com sucesso.
 *       403:
 *         description: Erro ao restaurar todas as sessões.
 */
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

/**
 * @swagger
 * /instance/logout/{sessionName}:
 *   delete:
 *     summary: Desconecta uma sessão específica.
 *     tags: [Instance]
 *     parameters:
 *       - in: path
 *         name: sessionName
 *         required: true
 *         description: Nome da sessão a ser desconectada.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sessão desconectada com sucesso.
 *       400:
 *         description: Nome da sessão é obrigatório.
 *       500:
 *         description: Erro ao desconectar a sessão.
 */
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

/**
 * @swagger
 * /instance/logoutAll:
 *   delete:
 *     summary: Desconecta todas as sessões.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Todas as sessões desconectadas com sucesso.
 *       500:
 *         description: Erro ao desconectar todas as sessões.
 */
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

/**
 * @swagger
 * /instance/deleteSession/{sessionName}:
 *   delete:
 *     summary: Exclui uma sessão específica.
 *     tags: [Instance]
 *     parameters:
 *       - in: path
 *         name: sessionName
 *         required: true
 *         description: Nome da sessão a ser excluída.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sessão excluída com sucesso.
 *       404:
 *         description: Sessão não encontrada.
 *       500:
 *         description: Erro ao excluir a sessão.
 */
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

/**
 * @swagger
 * /instance/clearUnusedSessions:
 *   delete:
 *     summary: Remove sessões não utilizadas.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Sessões não utilizadas removidas com sucesso.
 *       500:
 *         description: Erro ao remover sessões não utilizadas.
 */
instanceRoutes.delete("/instance/clearUnusedSessions", async (req, res) => {
  try {
    deleteUnusedSessions();
    res.status(200).json("Sessões não utilizadas foram removidas com sucesso.");
  } catch (error) {
    console.error("Erro ao limpar sessões não utilizadas:", error);
    res.status(500).json("Erro ao limpar sessões não utilizadas.");
  }
});

/**
 * @swagger
 * /instance/listFolders:
 *   get:
 *     summary: Lista todas as pastas de sessões.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Lista de pastas retornada com sucesso.
 */
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

/**
 * @swagger
 * /instance/fetchInstances:
 *   get:
 *     summary: Retorna informações de instâncias ativas.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Informações das instâncias retornadas com sucesso.
 *       404:
 *         description: Arquivo de instâncias não encontrado.
 *       500:
 *         description: Erro interno do servidor.
 */
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

/**
 * @swagger
 * /instance/fetchAllInstances:
 *   get:
 *     summary: Retorna informações de todas as instâncias.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Informações das instâncias retornadas com sucesso.
 *       404:
 *         description: Arquivo de instâncias não encontrado.
 *       500:
 *         description: Erro interno do servidor.
 */
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

/**
 * @swagger
 * /instance/getAllSessions:
 *   get:
 *     summary: Retorna todas as sessões.
 *     tags: [Instance]
 *     responses:
 *       200:
 *         description: Lista de sessões retornada com sucesso.
 *       500:
 *         description: Erro ao buscar as sessões.
 */
instanceRoutes.get("/instance/getAllSessions", async (req, res) => {
  try {
    const sessions = sessionsManager.getAllSessions();
    console.log("getAllSessions -", sessions);

    if (sessions && sessions.length > 0) {
      res.status(200).json({
        sessions,
      });
    } else {
      res.status(200).json({
        message: "No sessions found.",
        sessions: [],
      });
    }
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({
      error: "An unexpected error occurred while fetching sessions.",
    });
  }
});

/**
 * @swagger
 * /instance/connectionState/{instanceName}:
 *   get:
 *     summary: Retorna o estado de conexão de uma sessão específica.
 *     tags: [Instance]
 *     parameters:
 *       - in: path
 *         name: instanceName
 *         required: true
 *         description: Nome da instância.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado de conexão retornado com sucesso.
 *       404:
 *         description: Instância não encontrada.
 *       500:
 *         description: Erro ao buscar estado da conexão.
 */
instanceRoutes.get("/instance/connectionState/:instanceName", async (req, res) => {
  const { instanceName } = req.params;

  try {
    const session = sessionsManager.getSession(instanceName);

    if (!session) {
      console.error(`Sessão "${instanceName}" não encontrada.`);
      return res.status(404).json({
        error: "Instance not found",
        instanceName,
      });
    }

    if (!session.client) {
      console.warn(`Cliente não inicializado para a sessão "${instanceName}".`);
      return res.status(500).json({
        error: "Client not initialized",
        instanceName,
      });
    }

    return res.json({
      instanceName,
      state: session.client.connectionState,
    });
  } catch (error) {
    console.error(`Erro ao buscar estado da conexão para a instância "${instanceName}":`, error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

module.exports = instanceRoutes;

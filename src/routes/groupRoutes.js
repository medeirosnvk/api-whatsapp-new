const express = require("express");
const { createGroup, addParticipantsToGroup, sendMessageToGroup, listAllGroups } = require("../services/GroupServices/createGroupService");

const groupRoutes = express.Router();

groupRoutes.post("/message/createGroup/:instanceName", async (req, res) => {
  const { groupName, participants } = req.body;
  const { instanceName } = req.params;

  if (!instanceName || !groupName || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).send("instanceName, groupName e participants (array de números) são obrigatórios");
  }

  try {
    const group = await createGroup(instanceName, groupName, participants);

    res.status(200).json({
      status: "Sucesso ao criar o grupo.",
      group,
    });
  } catch (error) {
    console.error("Erro ao criar grupo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

groupRoutes.get("/message/listGroups/:instanceName", async (req, res) => {
  const { instanceName } = req.params;

  try {
    const groups = await listAllGroups(instanceName);
    res.status(200).json({ status: "Grupos listados com sucesso", groups });
  } catch (error) {
    console.error("Erro ao listar grupos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

groupRoutes.post("/message/addParticipants/:instanceName", async (req, res) => {
  const { groupId, participants } = req.body;
  const { instanceName } = req.params;

  if (!instanceName || !groupId || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).send("instanceName, groupId e participants (array de números) são obrigatórios.");
  }

  try {
    await addParticipantsToGroup(instanceName, groupId, participants);
    res.status(200).json({ status: "Sucesso ao adicionar participantes.", groupId, participants });
  } catch (error) {
    console.error("Erro na rota /addParticipants:", error);
    res.status(500).json({ error: error.message || "Erro interno no servidor" });
  }
});

groupRoutes.post("/message/sendGroupMessage/:instanceName", async (req, res) => {
  const { groupId, text } = req.body;
  const { instanceName } = req.params;

  if (!instanceName || !groupId || !text) {
    return res.status(400).send("instanceName, groupId e text são obrigatórios");
  }

  try {
    await sendMessageToGroup(instanceName, groupId, text);
    res.status(200).json({ status: "Mensagem enviado no grupo com sucesso.", groupId, text });
  } catch (error) {
    console.error("Erro ao enviar mensagem para o grupo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = groupRoutes;

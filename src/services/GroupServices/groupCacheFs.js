const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "../../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

const getFilePath = (instanceName) => path.join(CACHE_DIR, `groups-${instanceName}.json`);

const salvarGrupoEmCache = async ({ instanceName, groupId, nome }) => {
  const filePath = getFilePath(instanceName);
  let grupos = [];

  if (fs.existsSync(filePath)) {
    grupos = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  if (!grupos.find((g) => g.groupId === groupId)) {
    grupos.push({ groupId, nome });
    fs.writeFileSync(filePath, JSON.stringify(grupos, null, 2), "utf8");
  }
};

const buscarGruposEmCache = async (instanceName) => {
  const filePath = getFilePath(instanceName);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const buscarGruposEmCacheId = async (groupId) => {
  const filePath = getFilePath(groupId);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

module.exports = { salvarGrupoEmCache, buscarGruposEmCache, buscarGruposEmCacheId };

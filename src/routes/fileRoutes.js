require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const { getAllFiles } = require("../services/FileServices/getAllFilesService");

const port = process.env.PORT;
const urlHostIP = process.env.HOST_IP;
const urlWebhookMedia = `${urlHostIP}/${port}`;

const fileRoutes = express.Router();
const mediaDataPath = path.join(__dirname, "../media");

fileRoutes.use(express.urlencoded({ limit: "50mb", extended: true }));
fileRoutes.use(express.static("qrcodes"));

fileRoutes.get("/listAllFiles", async (req, res) => {
  try {
    // Verificar se o diretório existe
    if (!fs.existsSync(mediaDataPath)) {
      console.error(`Diretório ${mediaDataPath} não existe`);
      return res.status(400).json({ error: `Diretório ${mediaDataPath} não existe` });
    }

    console.log(`Lendo arquivos do diretório: ${mediaDataPath}`);
    const files = getAllFiles(mediaDataPath);

    // Obter informações de modificação dos arquivos
    const fileStats = files.map((file) => {
      const stat = fs.statSync(file);
      return { file, mtime: stat.mtime };
    });

    // Ordenar arquivos por data de modificação (mais recentes primeiro)
    fileStats.sort((a, b) => b.mtime - a.mtime);

    const fileUrls = fileStats.map(({ file }) => ({
      fileName: path.basename(file),
      url: `${urlWebhookMedia}/media${file.replace(mediaDataPath, "").replace(/\\/g, "/")}`,
    }));

    res.json(fileUrls);
  } catch (error) {
    console.error("Erro ao ler o diretório", error);
    res.status(500).json({ error: "Erro ao ler o diretório" });
  }
});

fileRoutes.use("/media", express.static(mediaDataPath));

module.exports = fileRoutes;

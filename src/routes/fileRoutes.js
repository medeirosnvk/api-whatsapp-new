require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const { getAllFiles } = require("../services/FileServices/getAllFilesService");

const urlWebhookMedia = process.env.URL_WEBHOOK_MEDIA;

const fileRoutes = express.Router();
const mediaDataPath = path.join(__dirname, "../media");

fileRoutes.use(express.urlencoded({ limit: "50mb", extended: true }));
fileRoutes.use(express.static("qrcodes"));

/**
 * @swagger
 * /listAllFiles:
 *   get:
 *     summary: Lista todos os arquivos de mídia recebidos
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: Sucesso ao listar arquivos
 *       400:
 *         description: Diretório não encontrado
 *       500:
 *         description: Erro interno ao tentar listar arquivos
 */
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

    res.status(200).json(fileUrls);
  } catch (error) {
    console.error("Erro ao ler o diretório", error);
    res.status(500).json({ error: "Erro ao tentar ler o diretório" });
  }
});

fileRoutes.use("/media", express.static(mediaDataPath));

module.exports = fileRoutes;

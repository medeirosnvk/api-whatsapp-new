const express = require("express");
const fs = require("fs");
const path = require("path");
const { deleteAllQRCodeImages } = require("../services/QrCodeServices/deleteAllQrCodeService");

const qrCodeRoutes = express.Router();

/**
 * @swagger
 * /instance/connect/{sessionName}:
 *   get:
 *     summary: Retorna QrCode em Base64.
 *     tags: [QRCode]
 *     parameters:
 *       - in: path
 *         name: sessionName
 *         required: true
 *         description: Nome da sessão a ser retornada.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QrCode Base64 retornado com sucesso.
 *       404:
 *         description: QrCode Base64 não encontrado.
 */
qrCodeRoutes.get("/instance/connect/:sessionName", async (req, res) => {
  const { sessionName } = req.params;

  const qrCodeFilePath = path.join(__dirname, "../../qrcodes", `qrcode_${sessionName}.png`);

  if (fs.existsSync(qrCodeFilePath)) {
    const image = fs.readFileSync(qrCodeFilePath, { encoding: "base64" });
    const base64Image = `data:image/png;base64,${image}`;
    res.status(200).json({
      instance: sessionName,
      base64: base64Image,
    });
  } else {
    res.status(404).json({ error: "QR code not found" });
  }
});

/**
 * @swagger
 * /instance/connect/image/{sessionName}:
 *   get:
 *     summary: Retorna QrCode em .png.
 *     tags: [QRCode]
 *     parameters:
 *       - in: path
 *         name: sessionName
 *         required: true
 *         description: Nome da sessão a ser retornada.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QrCode .png retornado com sucesso.
 *       404:
 *         description: QrCode .png não encontrado.
 */
qrCodeRoutes.get("/instance/connect/image/:sessionName", async (req, res) => {
  const { sessionName } = req.params;

  const qrCodeFilePath = path.join(__dirname, "../../qrcodes", `qrcode_${sessionName}.png`);

  if (fs.existsSync(qrCodeFilePath)) {
    // Define o tipo de conteúdo da resposta como imagem/png
    res.type("png");

    // Lê o arquivo de imagem e transmite como resposta
    fs.createReadStream(qrCodeFilePath).pipe(res);
  } else {
    res.status(404).json({ error: "QR code not found" });
  }
});

/**
 * @swagger
 * /qrcodes:
 *   delete:
 *     summary: Limpa todos os QrCodes da pasta /qrcodes
 *     tags: [QRCode]
 *     responses:
 *       200:
 *         description: Pasta limpa com sucesso.
 *       404:
 *         description: Erro ao tentar deletar as imagens.
 */
qrCodeRoutes.delete("/qrcodes", async (req, res) => {
  try {
    deleteAllQRCodeImages();
    res.status(200).json({
      success: true,
      message: "All QR code images deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: `Error deleting QR code images: ${error.message}`,
    });
  }
});

module.exports = qrCodeRoutes;

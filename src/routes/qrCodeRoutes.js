/* eslint-disable quotes */
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  deleteAllQRCodeImages,
} = require("../services/QrCodeServices/deleteAllQrCodeService");

const qrCodeRoutes = express.Router();

qrCodeRoutes.get("/instance/connect/:sessionName", (req, res) => {
  const { sessionName } = req.params;

  const qrCodeFilePath = path.join(
    __dirname,
    "qrcodes",
    `qrcode_${sessionName}.png`
  );

  if (fs.existsSync(qrCodeFilePath)) {
    const image = fs.readFileSync(qrCodeFilePath, { encoding: "base64" });
    const base64Image = `data:image/png;base64,${image}`;
    res.json({
      instance: sessionName,
      base64: base64Image,
    });
  } else {
    res.status(404).json({ error: "QR code not found" });
  }
});

qrCodeRoutes.get("/instance/connect/image/:sessionName", (req, res) => {
  const { sessionName } = req.params;

  const qrCodeFilePath = path.join(
    __dirname,
    "qrcodes",
    `qrcode_${sessionName}.png`
  );

  if (fs.existsSync(qrCodeFilePath)) {
    // Define o tipo de conteúdo da resposta como imagem/png
    res.type("png");

    // Lê o arquivo de imagem e transmite como resposta
    fs.createReadStream(qrCodeFilePath).pipe(res);
  } else {
    res.status(404).json({ error: "QR code not found" });
  }
});

qrCodeRoutes.delete("/qrcodes", (req, res) => {
  try {
    deleteAllQRCodeImages();
    res.json({
      success: true,
      message: "All QR code images deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: `Error deleting QR code images: ${error.message}`,
    });
  }
});

module.exports = { qrCodeRoutes };

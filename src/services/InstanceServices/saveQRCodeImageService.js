const fs = require("fs");
const path = require("path");
const qrImage = require("qr-image");

const qrCodeDataPath = path.join(__dirname, "../../../qrcodes");

const saveQRCodeImage = async (qr, sessionName) => {
  try {
    // Garantir que o diretório de QR Codes exista
    if (!fs.existsSync(qrCodeDataPath)) {
      fs.mkdirSync(qrCodeDataPath, { recursive: true });
      console.log(`Diretório criado: ${qrCodeDataPath}`);
    }

    // Gerar o QR Code e salvar a imagem
    const qrCodeImage = qrImage.image(qr, { type: "png" });
    const qrCodeFileName = `qrcode_${sessionName}.png`;
    const qrCodeFilePath = path.join(qrCodeDataPath, qrCodeFileName);

    const qrCodeWriteStream = fs.createWriteStream(qrCodeFilePath);
    qrCodeImage.pipe(qrCodeWriteStream);

    qrCodeWriteStream.on("finish", () => {
      console.log(`QR Code image saved: ${qrCodeFilePath}`);
    });

    qrCodeWriteStream.on("error", (error) => {
      console.error(`Erro ao salvar a imagem do QR Code: ${error.message}`);
    });
  } catch (error) {
    console.error(`Erro ao salvar QR Code para ${sessionName}: ${error.message}`);
  }
};

module.exports = { saveQRCodeImage };

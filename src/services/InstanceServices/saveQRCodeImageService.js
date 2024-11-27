const fs = require("fs");
const path = require("path");
const qrImage = require("qr-image");

const qrCodeDataPath = path.join(__dirname, "qrcodes");

const saveQRCodeImage = async (qr, sessionName) => {
  const qrCodeImage = qrImage.image(qr, { type: "png" });
  const qrCodeFileName = `qrcode_${sessionName}.png`;
  const qrCodeFilePath = path.join(qrCodeDataPath, qrCodeFileName);

  const qrCodeWriteStream = fs.createWriteStream(qrCodeFilePath);
  qrCodeImage.pipe(qrCodeWriteStream);

  qrCodeWriteStream.on("finish", () => {
    console.log(`QR Code image saved: ${qrCodeFilePath}`);
  });
};

module.exports = { saveQRCodeImage };

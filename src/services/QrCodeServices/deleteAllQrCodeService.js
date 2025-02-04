const fs = require("fs");
const path = require("path");

const deleteAllQRCodeImages = () => {
  const qrCodesDir = path.join(__dirname, "../src/qrcodes");

  if (fs.existsSync(qrCodesDir)) {
    const files = fs.readdirSync(qrCodesDir);
    files.forEach((file) => {
      const filePath = path.join(qrCodesDir, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filePath}:`, err);
        } else {
          console.log(`File ${filePath} deleted successfully`);
        }
      });
    });
  } else {
    console.log("QR codes directory does not exist.");
  }
};

module.exports = { deleteAllQRCodeImages };

const sessionManager = require("../../services/sessionsManager");
const { validateAndFormatNumber } = require("./validateNumberService");

const checkWhatsappNumber = async (sessionName, phoneNumber) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const formattedNumber = await validateAndFormatNumber(phoneNumber);
  const isRegistered = await session.client.isRegisteredUser(formattedNumber);

  if (isRegistered === true) {
    console.log(`Número ${phoneNumber} existe no WhatsApp, isRegistered -`, isRegistered);
    return isRegistered;
  } else {
    console.log(`Número ${phoneNumber} NÃO existe no WhatsApp, isRegistered -`, isRegistered);
    return isRegistered;
  }
};

module.exports = { checkWhatsappNumber };

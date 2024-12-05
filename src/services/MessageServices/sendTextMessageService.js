const sessionManager = require("../../services/sessionsManager");

const sendTextMessage = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);
  console.log(`sendTextMessage session - ${session}`);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.client.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  let processedNumber = phoneNumber;
  const brazilCountryCode = "55";

  if (processedNumber.startsWith(brazilCountryCode)) {
    const localNumber = processedNumber.slice(4);

    if (localNumber.length === 9 && localNumber.startsWith("9")) {
      processedNumber = brazilCountryCode + processedNumber.slice(2, 4) + localNumber.slice(1);
    }
  }

  console.log(`Número processado: ${processedNumber}`);
  console.log(`Texto: ${message.text}`);

  await session.client.sendMessage(`${processedNumber}@c.us`, message.text);
  // await client.sendMessage(`${processedNumber}@c.us`, textMessage.text);

  console.log(`Mensagem enviada para ${phoneNumber} na sessão ${sessionName}: ${message}`);
};

module.exports = { sendTextMessage };

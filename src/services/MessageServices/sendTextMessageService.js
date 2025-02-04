const sessionManager = require("../../services/sessionsManager");

const sendTextMessage = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
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

  try {
    await session.client.sendMessage(`${processedNumber}@c.us`, message.text);
    console.log(`Mensagem enviada para ${phoneNumber} na sessão ${sessionName}: ${message.text}`);
  } catch (error) {
    console.error(`- Erro: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    console.error(`- Detalhes adicionais:`, error);
    throw new Error(`Erro ao tentar enviar sendTextMessage: ${error.message}`);
  }
};

module.exports = { sendTextMessage };

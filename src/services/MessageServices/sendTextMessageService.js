const sessionManager = require("../../services/sessionsManager");

const sendTextMessage = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  // Formatar número
  const formattedNumber = phoneNumber.replace(/\D/g, ""); // Remove tudo que não for número

  if (!formattedNumber.startsWith("55") || formattedNumber.length < 12 || formattedNumber.length > 13) {
    throw new Error(`Número ${phoneNumber} inválido. Deve estar no formato internacional começando com 55.`);
  }

  const jid = `${formattedNumber}@c.us`;

  // Verificar se está registrado no WhatsApp
  const isRegistered = await session.client.isRegisteredUser(jid);
  if (!isRegistered) {
    throw new Error(`O número ${formattedNumber} não está registrado no WhatsApp.`);
  }

  console.log(`Número processado: ${formattedNumber}`);
  console.log(`Texto: ${message.text}`);

  try {
    await session.client.sendMessage(jid, message.text);
    console.log(`Mensagem enviada para ${phoneNumber} na sessão ${sessionName}: ${message.text}`);
  } catch (error) {
    console.error(`Erro ao enviar mensagem: ${error.message}`);
    throw new Error(`Erro ao tentar enviar mensagem: ${error.message}`);
  }
};

module.exports = { sendTextMessage };

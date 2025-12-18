const sessionManager = require("../../services/sessionsManager");

const sendTextMessage = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session?.client) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  let processedNumber = phoneNumber;
  const brazilCountryCode = "55";

  if (processedNumber.startsWith(brazilCountryCode)) {
    const ddd = processedNumber.slice(2, 4);
    const localNumber = processedNumber.slice(4);

    if (localNumber.length === 9 && localNumber.startsWith("9")) {
      processedNumber = brazilCountryCode + ddd + localNumber.slice(1);
    }
  }

  const jid = `${processedNumber}@c.us`;

  try {
    // Força o WhatsApp a resolver o contato e gerar o LID
    const contact = await session.client.getContactById(jid);

    if (!contact) {
      throw new Error("Contato não encontrado ou inválido");
    }

    await session.client.sendMessage(contact.id._serialized, message.text);

    console.log(`Mensagem enviada para ${processedNumber} na sessão ${sessionName}`);
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    throw new Error(`Erro ao tentar enviar sendTextMessage: ${error.message}`);
  }
};

module.exports = { sendTextMessage };

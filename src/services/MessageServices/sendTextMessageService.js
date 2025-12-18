const sessionManager = require("../../services/sessionsManager");

const sendTextMessage = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session?.client) {
    throw new Error(`Sessão ${sessionName} não encontrada`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  let processedNumber = String(phoneNumber);
  const brazilCountryCode = "55";

  if (processedNumber.startsWith(brazilCountryCode)) {
    const ddd = processedNumber.slice(2, 4);
    const localNumber = processedNumber.slice(4);

    if (localNumber.length === 9 && localNumber.startsWith("9")) {
      processedNumber = brazilCountryCode + ddd + localNumber.slice(1);
    }
  }

  const jid = `${processedNumber}@c.us`;

  const isRegistered = await session.client.isRegisteredUser(jid);
  if (!isRegistered) {
    throw new Error("Número não registrado no WhatsApp");
  }

  try {
    // força criação do chat e resolução interna
    await session.client.sendSeen(jid);

    await session.client.sendMessage(jid, message.text);

    console.log(`Mensagem enviada para ${processedNumber} na sessão ${sessionName}`);
  } catch (error) {
    const msg = String(error?.message || "");

    // tratamento especifico para erro de LID
    if (msg.includes("No LID for user")) {
      console.warn(`Falha de LID ao enviar para ${processedNumber}, tentando novamente`);

      try {
        // pequena espera antes do retry
        await new Promise((r) => setTimeout(r, 800));

        await session.client.sendMessage(jid, message.text);

        console.log(`Mensagem enviada no retry para ${processedNumber} na sessão ${sessionName}`);
        return;
      } catch (retryError) {
        console.error("Falha definitiva por LID", retryError);

        throw new Error("Não foi possível enviar a mensagem. O WhatsApp não conseguiu resolver o contato neste momento.");
      }
    }

    console.error("Erro ao enviar mensagem", error);
    throw new Error(`Erro ao tentar enviar mensagem: ${msg}`);
  }
};

module.exports = { sendTextMessage };

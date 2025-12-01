const sessionManager = require("../sessionsManager");
const { MessageMedia } = require("whatsapp-web.js");

// Helper: normalize brazilian phone numbers using right-to-left counting
const normalizeBrazilianNumber = (raw) => {
  if (!raw) return raw;
  const digits = String(raw).replace(/\D/g, "");

  const len = digits.length;
  if (len === 0) return digits;

  // Decide local number length (8 or 9) by inspecting the 9th digit from the right when available
  let localLen = 8; // default
  if (len >= 9) {
    const idx9FromRight = len - 9;
    if (digits[idx9FromRight] === "9") {
      localLen = 9;
    } else if (len === 11 || len === 12 || len === 13) {
      // heuristic: lengths that commonly include country + ddd + 9-digit mobile
      localLen = 9;
    }
  }

  const localNumber = digits.slice(-localLen);

  const dddStart = len - localLen - 2;
  const ddd = dddStart >= 0 ? digits.slice(dddStart, dddStart + 2) : "";

  const countryPart = dddStart > 0 ? digits.slice(0, dddStart) : "";
  const country = countryPart && countryPart.startsWith("55") ? countryPart : "55";

  // If we couldn't extract DDD (ddd empty), fallback to best-effort: return country + localNumber
  const normalized = ddd ? `${country}${ddd}${localNumber}` : `${country}${localNumber}`;

  // strip any accidental leading zeros
  return normalized.replace(/^0+/, "");
};

const stripDataUriPrefix = (data) => {
  if (!data || typeof data !== "string") return data;
  const idx = data.indexOf(",");
  if (idx === -1) return data;
  return data.slice(idx + 1);
};

const sendBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  console.log("sessionName", sessionName);
  console.log("connectionState", session.connectionState);
  console.log("client info", session.client.info ? session.client.info.wid : "sem info");
  console.log("isReady? ", typeof session.client.sendMessage === "function");

  const processedNumber = normalizeBrazilianNumber(String(phoneNumber));
  const jid = `${processedNumber}@c.us`;
  const { base64: rawBase64, fileName, caption, mimeType } = message || {};

  if (!rawBase64) throw new Error("Campo 'base64' ausente na mensagem.");

  const cleanBase64 = stripDataUriPrefix(rawBase64);
  const usedMime = mimeType || undefined;
  const messageMedia = new MessageMedia(usedMime, cleanBase64, fileName);

  // Função auxiliar para tentativas de envios com logs
  const trySend = async (targetId) => {
    try {
      await session.client.sendMessage(targetId, messageMedia, { caption });
      console.log(`Enviado com sucesso para ${targetId}`);
      return true;
    } catch (err) {
      console.warn(`Falha ao enviar para ${targetId}, erro:`, err && err.message ? err.message : err);
      return false;
    }
  };

  try {
    // tentativa padrão de obter lid e telefone
    try {
      const lidResult = await session.client.getContactLidAndPhone([jid]);
      console.log("getContactLidAndPhone result", lidResult);
      // se retornou um mapeamento, use o jid normal para enviar
      if (Array.isArray(lidResult) && lidResult.length > 0) {
        const entry = lidResult[0];
        // entry pode ter { lid, pn } dependendo da versão
        if (entry && entry.pn) {
          const target = `${normalizeBrazilianNumber(entry.pn)}@c.us`;
          const ok = await trySend(target);
          if (ok) return;
        }
      }
    } catch (err) {
      // Captura o erro específico, mas não para a execução, vamos aplicar fallbacks
      console.warn("getContactLidAndPhone falhou, aplicando fallbacks:", err && err.message ? err.message : err);
    }

    // 1º fallback, tente enviar direto para o jid formado a partir do número fornecido
    if (await trySend(jid)) return;

    // 2º fallback, tente recuperar o contact/chat pela API da lib
    try {
      const contact = await session.client.getContactById(jid).catch(() => null);
      const chat = await session.client.getChatById(jid).catch(() => null);
      console.log("contact fallback", !!contact, "chat fallback", !!chat);
      if (contact || chat) {
        if (await trySend(jid)) return;
      }
    } catch (err) {
      console.warn("Erro ao tentar getContactById/getChatById:", err && err.message ? err.message : err);
    }

    // 3º fallback, tentar converter @lid para @c.us no contexto da página, se as funções internas existirem
    try {
      if (session.client.pupPage && typeof session.client.pupPage.evaluate === "function") {
        const converted = await session.client.pupPage.evaluate((rawId) => {
          try {
            // Tentativa de usar WidFactory ou outras rotinas internas, protegida por try/catch
            if (window.Store && window.Store.WidFactory && typeof window.Store.WidFactory.toUserWidOrThrow === "function") {
              const wid = window.Store.WidFactory.toUserWidOrThrow(rawId);
              return wid && wid && wid.user ? `${wid.user}@c.us` : null;
            }
            // alternativa tentar buscar na store de contatos
            if (window.Store && window.Store.Contact) {
              const item = window.Store.Contact.get(rawId);
              if (item && item.id && item.id.user) return `${item.id.user}@c.us`;
            }
            return null;
          } catch (e) {
            return null;
          }
        }, jid);

        console.log("converted from page context", converted);
        if (converted && (await trySend(converted))) return;
      }
    } catch (err) {
      console.warn("Falha ao executar avaliação na página para converter LID:", err && err.message ? err.message : err);
    }

    // Se chegou aqui, todas as tentativas falharam
    throw new Error(
      `Não foi possível enviar a mensagem, nenhuma estratégia teve sucesso para ${phoneNumber}, verifique se o número está acessível a partir da sessão e se a sessão está atualizada.`
    );
  } catch (error) {
    console.error(`Erro ao enviar mensagem para ${phoneNumber}:`, error);
    throw error;
  }
};

const sendAudioBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) {
    throw new Error(`Sessão ${sessionName} não encontrada.`);
  }

  if (session.connectionState !== "open") {
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
  }

  const processedNumber = normalizeBrazilianNumber(String(phoneNumber));

  let { base64: rawBase64, fileName, caption, mimeType } = message || {};

  if (!rawBase64) throw new Error("Campo 'base64' ausente na mensagem.");

  // If data URI, detect mime and strip prefix
  if (rawBase64.startsWith("data:")) {
    // format: data:<mimeType>;base64,<data>
    const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = mimeType || match[1];
      rawBase64 = match[2];
    } else {
      // fallback: split at first comma
      rawBase64 = stripDataUriPrefix(rawBase64);
    }
  } else {
    rawBase64 = stripDataUriPrefix(rawBase64);
  }

  const messageMedia = new MessageMedia(mimeType || "audio/ogg", rawBase64, fileName);

  try {
    await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log(
      `Mensagem de áudio Base64 enviada com sucesso ao número ${phoneNumber} (processado: ${processedNumber}) pela instância ${sessionName} no horário ${new Date()}!`
    );
  } catch (error) {
    console.error(`Erro ao enviar áudio para ${phoneNumber}:`, error);
    throw error;
  }
};

module.exports = { sendBase64Message, sendAudioBase64Message };

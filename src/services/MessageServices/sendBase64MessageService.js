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
  const { base64: rawBase64, fileName, caption, mimeType } = message || {};
  const jid = `${processedNumber}@c.us`;

  if (!rawBase64) throw new Error("Campo 'base64' ausente na mensagem.");

  const cleanBase64 = stripDataUriPrefix(rawBase64);
  const usedMime = mimeType || undefined;
  const messageMedia = new MessageMedia(usedMime, cleanBase64, fileName);

  try {
    const lid = await session.client.getContactLidAndPhone([jid]);
    console.log("getContactLidAndPhone result", lid);

    await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log(
      `Mensagem de mídia Base64 enviada com sucesso ao número ${phoneNumber} (processado: ${processedNumber}) pela instância ${sessionName} no horário ${new Date()}!`
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

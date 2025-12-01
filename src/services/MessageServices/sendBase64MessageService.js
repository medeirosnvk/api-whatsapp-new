const { MessageMedia } = require("whatsapp-web.js");
const { randomBytes } = require("crypto");
const mime = require("mime-types");
const sessionManager = require("../../services/sessionsManager");

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

const stripDataUriPrefix = (s) => {
  if (!s) return s;
  // aceita formatos como: data:[mime];base64,AAAA...
  const idx = s.indexOf("base64,");
  if (idx !== -1) return s.slice(idx + "base64,".length);
  // se já é uma base64 "pura", só remove espaços/quebras e retorna
  return s;
};

const ensureBase64Clean = (b64) => {
  // remove espaços, quebras, tabs que podem vir por formatação
  return b64.replace(/\s+/g, "");
};

const inferMimeFromFilename = (filename) => {
  if (!filename) return null;
  const inferred = mime.lookup(filename); // ex: 'image/png'
  return inferred || null;
};

const extensionFromMime = (mimeType) => {
  if (!mimeType) return "bin";
  const ext = mime.extension(mimeType);
  return ext || "bin";
};

const ensureFilenameHasExtension = (fileName, mimeType) => {
  if (!fileName) {
    const ext = extensionFromMime(mimeType);
    return `file-${randomBytes(4).toString("hex")}.${ext}`;
  }
  // se nome sem ponto, acrescenta extensão
  const hasExt = /\.[a-z0-9]+$/i.test(fileName);
  if (!hasExt) {
    const ext = extensionFromMime(mimeType);
    return `${fileName}.${ext}`;
  }
  return fileName;
};

const validateBase64 = (b64) => {
  try {
    const buf = Buffer.from(b64, "base64");
    // falha se string inválida -> buf terá length 0 possivelmente
    if (!buf || buf.length === 0) return false;
    // opcional: re-encode e comparar prefixo para detectar truncamento
    const re = buf.toString("base64").slice(0, 8);
    return re.length > 0;
  } catch (err) {
    return false;
  }
};

const ensureInternationalNumber = (raw) => {
  // usa sua função existente, mas garanta que começa com DDI
  let n = normalizeBrazilianNumber(String(raw));
  // se normalizeBrazilianNumber não acrescenta 55, tenta forçar
  if (!n.startsWith("55")) {
    // se começar com 0 ou com +, limpa e adiciona 55
    n = n.replace(/^\+|^00|^0+/g, "");
    if (!n.startsWith("55")) n = `55${n}`;
  }
  return n;
};

// função principal reforçada
const sendBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);
  if (!session) throw new Error(`Sessão ${sessionName} não encontrada.`);
  if (session.connectionState !== "open")
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);

  const processedNumber = ensureInternationalNumber(phoneNumber);

  let { base64: rawBase64, fileName, caption, mimeType } = message || {};

  if (!rawBase64) throw new Error("Campo 'base64' ausente na mensagem.");

  // limpa prefixos e espaços
  let cleanBase64 = stripDataUriPrefix(rawBase64);
  cleanBase64 = ensureBase64Clean(cleanBase64);

  // tenta inferir mime do fileName se não veio mimeType
  if (!mimeType) mimeType = inferMimeFromFilename(fileName);

  // se ainda nao tem mime, tenta detectar se o raw contém data:prefix
  if (!mimeType) {
    const match = rawBase64.match(/^data:([^;]+);base64,/i);
    if (match) mimeType = match[1];
  }

  // fallback seguro
  if (!mimeType) mimeType = "application/octet-stream";

  // garante filename com extensão coerente
  fileName = ensureFilenameHasExtension(fileName, mimeType);

  // valida base64 antes de enviar
  if (!validateBase64(cleanBase64)) {
    console.error("Base64 inválido, tamanho:", cleanBase64.length, "mime:", mimeType, "filename:", fileName);
    throw new Error("Base64 inválido ou corrompido.");
  }

  const messageMedia = new MessageMedia(mimeType, cleanBase64, fileName);

  try {
    await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, { caption });
    console.log(
      `Mensagem de mídia Base64 enviada com sucesso ao número ${phoneNumber} (processado: ${processedNumber}) pela instância ${sessionName} no horário ${new Date()}!`
    );
  } catch (error) {
    // log extendido para entender erro de LID
    console.error(
      "Erro no envio de mídia base64, detalhes:",
      {
        phoneNumber,
        processedNumber,
        sessionName,
        mimeType,
        fileName,
        base64Length: cleanBase64.length,
      },
      error
    );
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

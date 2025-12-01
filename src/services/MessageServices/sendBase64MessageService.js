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

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const inspectStoreForLid = async (client, jid) => {
  // tenta encontrar uma página puppeteer exposta pela lib
  const page = client.page || client.pupPage || client.puppeteerPage || client.pageBrowser;
  if (!page || typeof page.evaluate !== "function") {
    console.warn("Página puppeteer não disponível para inspeção direta do Store");
    return null;
  }

  try {
    const storeResult = await page.evaluate((jidArg) => {
      // tentativa segura para acessar várias possíveis chaves do Store
      try {
        const contact =
          window.Store &&
          (window.Store.Contact
            ? window.Store.Contact.get(jidArg)
            : window.Store.Contact &&
              window.Store.Contact.models &&
              window.Store.Contact.models.get &&
              window.Store.Contact.models.get(jidArg));
        const chat = window.Store && (window.Store.Chat ? window.Store.Chat.get(jidArg) : null);
        return {
          contact: contact
            ? {
                id: contact.id && contact.id._serialized ? contact.id._serialized : contact.id,
                lid:
                  contact && (contact.lid || contact.__x_lid || (contact.id && contact.id.user))
                    ? contact.lid || contact.__x_lid || (contact.id && contact.id.user)
                    : null,
                raw: !!contact,
              }
            : null,
          chat: chat
            ? {
                id: chat.id && chat.id._serialized ? chat.id._serialized : chat.id,
                hasMessages: Array.isArray(chat.msgs) ? chat.msgs.length : chat.msgs ? true : false,
              }
            : null,
        };
      } catch (e) {
        return { error: String(e) };
      }
    }, jid);
    return storeResult;
  } catch (err) {
    console.warn("Erro ao avaliar page.evaluate para Store", err?.message || err);
    return null;
  }
};

const tryGetLidWithPolling = async (client, jid, attempts = 6, initialDelay = 500) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await client.getContactLidAndPhone([jid]);
      if (Array.isArray(res) && res[0] && res[0].lid) {
        return res[0];
      }
      console.log(`Polling getContactLidAndPhone tentativa ${i + 1} sem lid`);
    } catch (err) {
      console.warn(`Erro em getContactLidAndPhone tentativa ${i + 1}`, err?.message || err);
    }
    await wait(initialDelay * (i + 1)); // backoff linear
  }
  return null;
};

const sendBase64Message = async (sessionName, phoneNumber, message) => {
  const session = sessionManager.getSession(sessionName);

  if (!session) throw new Error(`Sessão ${sessionName} não encontrada.`);
  if (session.connectionState !== "open")
    throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);

  const processedNumber = normalizeBrazilianNumber(String(phoneNumber));
  const jid = `${processedNumber}@c.us`;

  const { base64: rawBase64, fileName, caption, mimeType } = message || {};
  if (!rawBase64) throw new Error("Campo 'base64' ausente na mensagem.");

  const cleanBase64 = stripDataUriPrefix(rawBase64);
  const dataUrl = rawBase64.startsWith("data:") ? rawBase64 : `data:${mimeType || "application/octet-stream"};base64,${cleanBase64}`;

  try {
    console.log("Iniciando envio de mídia para", jid);

    // 1) tentativa inicial de obter lid
    let lidEntry = null;
    try {
      const initial = await session.client.getContactLidAndPhone([jid]);
      console.log("getContactLidAndPhone result", initial);
      lidEntry = Array.isArray(initial) && initial.length ? initial[0] : null;
    } catch (err) {
      console.warn("Erro na chamada inicial getContactLidAndPhone", err?.message || err);
    }

    // 2) se não houver lid, faz polling (poderá obter lid se a store for atualizada por ações anteriores)
    if (!lidEntry || !lidEntry.lid) {
      console.log("LID ausente, iniciando polling para tentar obter lid automaticamente");
      const polled = await tryGetLidWithPolling(session.client, jid, 4, 800);
      if (polled && polled.lid) {
        lidEntry = polled;
        console.log("LID obtido via polling", lidEntry);
      }
    }

    // 3) se ainda não houver lid, enviar mensagem temporária para forçar criação do chat e re-polling
    let tempMessage = null;
    if (!lidEntry || !lidEntry.lid) {
      try {
        console.log("Enviando mensagem temporária para forçar criação do chat/contato no store");
        tempMessage = await session.client.sendMessage(jid, "."); // mensagem curta
        // aguardar um pouco mais, alguns casos exigem mais tempo
        await wait(1200);
        // polling mais agressivo
        const polledAfterTemp = await tryGetLidWithPolling(session.client, jid, 6, 1000);
        if (polledAfterTemp && polledAfterTemp.lid) {
          lidEntry = polledAfterTemp;
          console.log("LID obtido após mensagem temporária", lidEntry);
        } else {
          console.warn("Ainda não obteve LID após mensagem temporária, vamos tentar inspecionar o Store para diagnóstico");
        }
      } catch (errTempSend) {
        console.warn("Falha ao enviar mensagem temporária", errTempSend?.message || errTempSend);
      }
    }

    // 4) inspeção direta do Store para entender onde o lid poderia estar, útil para debug
    if (!lidEntry || !lidEntry.lid) {
      try {
        const storeInfo = await inspectStoreForLid(session.client, jid);
        console.log("Resultado da inspeção do Store", storeInfo);
      } catch (errInspect) {
        console.warn("Inspeção do Store falhou", errInspect?.message || errInspect);
      }
    }

    // 5) montar MessageMedia preferencialmente com helper
    let messageMedia;
    if (MessageMedia.fromDataUrl) {
      try {
        messageMedia = MessageMedia.fromDataUrl(dataUrl, fileName);
      } catch (err) {
        console.warn("MessageMedia.fromDataUrl falhou, fallback para construtor direto", err?.message || err);
      }
    }
    if (!messageMedia) {
      const usedMime = mimeType || "application/octet-stream";
      messageMedia = new MessageMedia(usedMime, cleanBase64, fileName);
    }

    // 6) tentativa principal de envio
    try {
      await session.client.sendMessage(jid, messageMedia, { caption });
      console.log(`Mensagem de mídia enviada com sucesso para ${jid}`);
      // tenta apagar temp message se existir
      if (tempMessage && typeof tempMessage.delete === "function") {
        try {
          await tempMessage.delete(true);
          console.log("Mensagem temporária apagada com sucesso");
        } catch (errDel) {
          console.warn("Falha ao apagar mensagem temporária", errDel?.message || errDel);
        }
      }
      return;
    } catch (errSend) {
      console.error("Tentativa principal de envio falhou", errSend?.message || errSend);
      const errMsg = String(errSend?.message || "");
      // se parecer erro de LID, tentamos fallbacks
      if (!errMsg.includes("No LID") && !errMsg.includes("No LID for user")) {
        // repassar se não é problema de LID
        throw errSend;
      }
      console.log("Erro apontando para LID, executando fallbacks adicionais");
    }

    // 7) fallback com Buffer
    try {
      const buffer = Buffer.from(cleanBase64, "base64");
      await session.client.sendMessage(jid, buffer, { filename: fileName, mimetype: mimeType, caption });
      console.log("Fallback com Buffer enviado com sucesso.");
      return;
    } catch (errBuffer) {
      console.warn("Fallback com Buffer falhou", errBuffer?.message || errBuffer);
    }

    // 8) fallback prepareMessageMedia se disponível
    try {
      if (typeof session.client.prepareMessageMedia === "function") {
        const prepared = await session.client.prepareMessageMedia(dataUrl, { filename: fileName });
        if (prepared) {
          await session.client.sendMessage(jid, prepared, { caption });
          console.log("Fallback prepareMessageMedia enviado com sucesso.");
          return;
        } else {
          console.warn("prepareMessageMedia retornou vazio");
        }
      } else {
        console.warn("prepareMessageMedia não disponível nesta versão do cliente");
      }
    } catch (errPrepare) {
      console.warn("prepareMessageMedia falhou", errPrepare?.message || errPrepare);
    }

    // 9) última tentativa diagnóstica, logar e falhar com instrução
    throw new Error(
      `Não foi possível enviar mídia para ${jid}. Tentativas: obtenção de LID inicial, polling, envio temporário, inspeção do Store, envio direto, Buffer e prepareMessageMedia. Cheque logs de inspeção do Store, e se necessário re-autentique ou abra o chat manualmente na sessão.`
    );
  } catch (error) {
    console.error(`Erro ao enviar sendBase64Message para ${phoneNumber} via ${sessionName}:`, error?.message || error);
    throw new Error(`Erro ao tentar enviar sendBase64Message: ${error?.message || error}`);
  }
};

// const sendBase64Message = async (sessionName, phoneNumber, message) => {
//   const session = sessionManager.getSession(sessionName);

//   if (!session) {
//     throw new Error(`Sessão ${sessionName} não encontrada.`);
//   }

//   if (session.connectionState !== "open") {
//     throw new Error(`Sessão ${sessionName} não está conectada. Estado atual: ${session.connectionState}`);
//   }

//   console.log("sessionName", sessionName);
//   console.log("connectionState", session.connectionState);
//   console.log("client info", session.client.info ? session.client.info.wid : "sem info");
//   console.log("isReady? ", typeof session.client.sendMessage === "function");

//   const processedNumber = normalizeBrazilianNumber(String(phoneNumber));
//   const { base64: rawBase64, fileName, caption, mimeType } = message || {};
//   const jid = `${processedNumber}@c.us`;

//   if (!rawBase64) throw new Error("Campo 'base64' ausente na mensagem.");

//   const cleanBase64 = stripDataUriPrefix(rawBase64);
//   const usedMime = mimeType || undefined;
//   const messageMedia = new MessageMedia(usedMime, cleanBase64, fileName);

//   try {
//     const lid = await session.client.getContactLidAndPhone([jid]);
//     console.log("getContactLidAndPhone result", lid);

//     await session.client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
//       caption: caption,
//     });

//     console.log(
//       `Mensagem de mídia Base64 enviada com sucesso ao número ${phoneNumber} (processado: ${processedNumber}) pela instância ${sessionName} no horário ${new Date()}!`
//     );
//   } catch (error) {
//     console.error(`Erro ao enviar mensagem para ${phoneNumber}:`, error);
//     throw error;
//   }
// };

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

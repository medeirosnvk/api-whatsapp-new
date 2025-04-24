const sessionManager = require("../sessionsManager");
const { MessageMedia } = require("whatsapp-web.js");
const requests = require("../requests");

function formatarValorBR(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(valor);
}

function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}-${mes}-${ano}`;
}

const sendMessageNewVoice = async (iddevedor, plano, telefone, token) => {
  const sessions = sessionManager.getAllSessions();
  const openSessions = sessions.filter((sess) => sess.connectionState === "open" && sess.info);

  if (!openSessions.length) {
    throw new Error("Nenhuma sessão 'open' disponível para envio de mensagem.");
  }

  const sessionName = openSessions[0].sessionName;
  const client = sessionManager.getSession(sessionName).client;

  // Limpa tudo que não é número
  const nums = telefone.replace(/\D/g, ""); // ex: "5551985071891" ou "555185071891"

  // Valida país e tamanho mínimo
  if (!nums.startsWith("55") || nums.length < 12 || nums.length > 13) {
    throw new Error(`Número ${telefone} inválido. Deve estar no formato 55DD[9]NNNNNNNN.`);
  }

  const pais = nums.slice(0, 2); // "55"
  const ddd = nums.slice(2, 4); // ex: "51"
  let corpo = nums.slice(4); // ex: "985071891" (9 dígitos) ou "85071891" (8 dígitos)

  // Se vier com 9 dígitos e começar com '9', remove o primeiro
  if (corpo.length === 9) {
    if (corpo[0] !== "9") {
      throw new Error(`Número ${telefone} após DDD tem 9 dígitos e deveria começar com '9'.`);
    }
    corpo = corpo.slice(1); // remove o '9', deixando 8 dígitos
  } else if (corpo.length !== 8) {
    // Se não for nem 8 nem 9, erro
    throw new Error(`Número ${telefone} inválido. Deve ter 8 ou 9 dígitos após DDD.`);
  }

  const telefoneFormatado = `${pais}${ddd}${corpo}@c.us`;

  // Inserir o acordo master e aguardar resposta
  const dataAcordoMaster = await requests.inserirAcordoMaster(Number(iddevedor), Number(plano), token);

  if (dataAcordoMaster.error) {
    throw new Error(dataAcordoMaster.error);
  }

  // Preparar textoPrincipal
  const { primeiraEtapaResponse, terceiraEtapaResponse } = dataAcordoMaster;

  const dataFormatada = formatarDataBR(primeiraEtapaResponse.ultimaDataVencimento);
  const valorParcelaOriginal = Number(primeiraEtapaResponse.valor_parcela);
  const acrescimo = 9.9;
  const valorComAcrescimo = valorParcelaOriginal + acrescimo;
  const valorFormatado = formatarValorBR(valorComAcrescimo);

  const textoAcordo = `*ACORDO REALIZADO COM SUCESSO!*\n\nPague a primeira parcela através do QRCODE ou link do BOLETO abaixo:\n${terceiraEtapaResponse.urlBoleto}\n\nOu utilize o PIX copia e cola abaixo:\n${terceiraEtapaResponse.pixCopiaECola}`;
  const textoRecibo = `*ATENÇÃO! CONFIRA SEUS DADOS E VALOR NA HORA DO PAGAMENTO!*\n\nPor favor, nos envie o *comprovante* assim que possivel para registro!\nAtendimento finalizado, obrigado e bons negócios.`;
  const textoPrincipal = textoAcordo + textoRecibo;

  // Enviar textoPrincipal
  await client.sendMessage(telefoneFormatado, textoPrincipal);

  // Preparar e enviar QR Code
  const qrBase64 = terceiraEtapaResponse.urlQrCodeBase64;
  const [header, data] = qrBase64.split(",");
  const mime = header.match(/data:(.*);base64/)[1];
  const media = new MessageMedia(mime, data, "qrcode.png");

  // Enviar imagem Qrcode
  await client.sendMessage(telefoneFormatado, media);

  console.log(`Texto e QR Code enviados para ${telefone} pela sessão ${sessionName}`);
};

module.exports = { sendMessageNewVoice };

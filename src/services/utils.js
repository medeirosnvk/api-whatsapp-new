const requests = require("./requests");

const fs = require("fs");
const fetch = require("node-fetch");

function getBrazilTimeFormatted(date) {
  const offset = -3; // Horário padrão do Brasil (sem considerar horário de verão)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000; // Converte para UTC
  const brazilDate = new Date(utc + 3600000 * offset); // Ajusta para o fuso horário de São Paulo
  return brazilDate.toLocaleString("pt-BR", { hour12: false });
}

function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    console.error("Phone number is undefined or null");
    return ""; // Ou outra ação apropriada, dependendo do seu caso
  }

  // Realizar formatação apenas se phoneNumber for uma string
  if (typeof phoneNumber === "string") {
    return phoneNumber.replace(/[^\d]/g, "").replace(/^.*?(\d{8})$/, "$1");
  } else {
    console.error("Phone number is not a string");
    return ""; // Ou outra ação apropriada, dependendo do seu caso
  }
}

function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatValue(number) {
  if (number !== undefined && number !== null) {
    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } else {
    return "N/A";
  }
}

function formatarMoeda(valorString) {
  let valorNumerico = parseFloat(valorString);
  if (isNaN(valorNumerico)) {
    return "Formato inválido";
  }
  return valorNumerico.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCredorOfertas(ofertas) {
  return ofertas
    .map((detalhe, index) => {
      const total = parseFloat(detalhe.valor_parcela) + parseFloat(detalhe.tarifa_boleto);
      const totalFormatado = formatarMoeda(total.toFixed(2));
      if (index === 0) {
        return `*${index + 1}*) À vista ${totalFormatado}`;
      } else {
        return `*${index + 1}*) Parcelamento em ${index + 1} x ${totalFormatado}`;
      }
    })
    .join("\n");
}

function formatCredorInfo(creditorInfo) {
  return creditorInfo
    .map(
      (info, index) =>
        `*${index + 1}*)\n` + `Empresa: ${info.empresa}\n` + `Seu Código na Cobrance: ${info.iddevedor}\n` + `Saldo Principal: ${formatValue(info.saldo)}`
    )
    .join("\n\n");
}

function formatCredorAcordos(creditorAcordos) {
  return creditorAcordos
    .map(
      (info, index) =>
        `*${index + 1}*)\n` +
        `Empresa: ${info.credor}\n` +
        `Seu Código na Cobrance: ${info.iddevedor}\n` +
        `IdAcordo: ${info.idacordo}\n` +
        `Data Acordo: ${formatDateIsoToBr(info.dataacordo)}\n` +
        `Parcelamento: ${info.plano}x`
    )
    .join("\n\n");
}

function formatCredorDividas(creditorDividas) {
  return creditorDividas
    .map(
      (info, index) =>
        // `${index + 1})\n` +
        `Contrato: ${info.contrato}\n` +
        `Vencimento: ${formatDateIsoToBr(info.vencimento)}\n` +
        `Dias Atraso: ${info.diasatraso}\n` +
        `Valor: ${formatValue(info.valor)}`
    )
    .join("\n\n");
}

function formatCodigoBoleto(creditorBoleto) {
  // Verifica se creditorBoleto é um array e se contém elementos
  if (!Array.isArray(creditorBoleto) || creditorBoleto.length === 0) {
    return "Array vazio ou nao é um array!"; // Retorna uma string vazia se o array estiver vazio ou não for um array
  }

  // Verifica se o primeiro elemento do array é um array
  const isArrayofArrays = Array.isArray(creditorBoleto[0]);

  // Se for um array de array de objetos, achatamos o array
  const flattenedArray = isArrayofArrays ? creditorBoleto.flat() : creditorBoleto;

  return flattenedArray
    .map(
      (info, index) =>
        `CPF/CNPJ: ${info.cpfcnpj}\n` +
        `Seu Código na Cobrance: ${info.iddevedor}\n` +
        `ID Acordo: ${info.idacordo}\n` +
        `Valor: ${formatValue(info.VALDOC)}\n` +
        `Parcela: ${info.parcela}\n` +
        `Linha Digitavel: ${info.linha}`
    )
    .join("\n\n");
}

function formatCodigoPix(creditorBoleto) {
  // Verifica se creditorBoleto é um array e se contém elementos
  if (!Array.isArray(creditorBoleto) || creditorBoleto.length === 0) {
    return "Array vazio ou nao é um array!"; // Retorna uma string vazia se o array estiver vazio ou não for um array
  }

  // Verifica se o primeiro elemento do array é um array
  const isArrayofArrays = Array.isArray(creditorBoleto[0]);

  // Se for um array de array de objetos, achatamos o array
  const flattenedArray = isArrayofArrays ? creditorBoleto.flat() : creditorBoleto;

  return flattenedArray
    .map(
      (info, index) =>
        `CPF/CNPJ: ${info.cpfcnpj}\n` +
        `Seu Código na Cobrance: ${info.iddevedor}\n` +
        `ID Acordo: ${info.idacordo}\n` +
        `Valor: ${formatValue(info.VALDOC)}\n` +
        `Parcela: ${info.parcela}\n` +
        `PIX Copia e Cola: ${info.emv}`
    )
    .join("\n\n");
}

function getCurrentDate() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTime() {
  const now = new Date();
  const options = {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  return now.toLocaleTimeString("pt-BR", options);
}

function formatDateIsoToBr(data) {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateRegistroBr(dateString) {
  const date = new Date(dateString);
  date.setUTCHours(0, 0, 0, 0); // Define a hora para meia-noite (00:00:00) no fuso horário UTC
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function formatDateRegistroBrUTC(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`); // Adiciona a hora e o UTC ao criar a data
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function formatDateInverse(dataString) {
  const data = new Date(dataString);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function getUltimaDataParcela(periodicidade, valor_parcela, plano) {
  try {
    const parcelasArray = [];
    const valorParcelaFloat = parseFloat(valor_parcela);
    let ultimaData = new Date(); // Variável para armazenar a última data de vencimento

    for (let i = 0; i < plano; i += 1) {
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + i * periodicidade); // Incrementa 7 dias para cada parcela
      const valorParcelaAtual = valorParcelaFloat.toFixed(2);
      parcelasArray.push({ vencimento, valorParcelaAtual });

      // Atualiza a última data de vencimento a cada iteração
      ultimaData = vencimento;
    }

    return { parcelasArray, ultimaData };
  } catch (error) {
    console.error(error);
  }
}

function parseDadosAcordo(props) {
  const {
    iddevedor,
    plano,
    idcredor,
    total_geral,
    currentTime,
    ultimaDataVencimento,
    juros_percentual,
    honorarios_percentual,
    multa_percentual,
    tarifa_boleto,
    responseDividasCredores,
  } = props;

  const currentDate = new Date().toISOString().slice(0, 10);

  const insertMessageAcordo = () => {
    const currentDateFormat = formatDateRegistroBr(currentDate);
    const currentDataBase = formatDateRegistroBrUTC(ultimaDataVencimento);
    const currentTimeFormat = getCurrentTime();

    const message = `
Juros.....: ${juros_percentual} %
Honorarios: ${honorarios_percentual} %
Multa.....: ${multa_percentual} %
Campanha..: 
Desconto..: 
Inclusão..: ${currentDateFormat}
Data Base.: ${currentDataBase}
====================================================================================================
  CONTRATO      PARCELA VENCIMENTO   VALOR      JUROS      MULTA     DESCONTO  HONORARIOS   TOTAL   
--------------- ------- ---------- ---------- ---------- ---------- ---------- ---------- ----------
`;

    let dynamicMessage = "";

    responseDividasCredores.forEach((dividas, index, array) => {
      const contrato = dividas.contrato.padEnd(15, " ");
      const parcela = "10".padStart(7, " ");
      const vencimento = formatDateRegistroBr(dividas.vencimento);

      const formatNumber = (number) => {
        const formattedNumber = number.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return formattedNumber.replace("R$", "").trim();
      };

      const valor = formatNumber(Number(dividas.saldo)).padStart(10, " ");
      const juros = formatNumber(Number(dividas.juros_calculado)).padStart(10, " ");
      const multa = formatNumber(Number(dividas.multa_calculada)).padStart(10, " ");
      const desconto = "0,00".padStart(10, " ");
      const honorarios = formatNumber(Number(dividas.honorarios_calculado)).padStart(10, " ");
      const total = formatNumber(Number(dividas.total)).padStart(10, " ");

      if (index === array.length - 1) {
        dynamicMessage += `${contrato} ${parcela} ${vencimento} ${valor} ${juros} ${multa} ${desconto} ${honorarios} ${total}`;
      } else {
        dynamicMessage += `${contrato} ${parcela} ${vencimento} ${valor} ${juros} ${multa} ${desconto} ${honorarios} ${total}\n`;
      }
    });

    let somaSaldo = 0;
    let somaJurosCalculado = 0;
    let somaMultaCalculada = 0;
    let somaHonorariosCalculado = 0;
    let somaTotal = 0;

    responseDividasCredores.forEach((array) => {
      somaSaldo += array.saldo || 0;
      somaJurosCalculado += array.juros_calculado || 0;
      somaMultaCalculada += array.multa_calculada || 0;
      somaHonorariosCalculado += array.honorarios_calculado || 0;
      somaTotal += array.total || 0;
    });

    const formatNumber = (number) => {
      const formattedNumber = number.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return formattedNumber.replace("R$", "").trim();
    };

    const totalSaldo = formatNumber(somaSaldo).padStart(45, " ");
    const totalJuros = formatNumber(somaJurosCalculado).padStart(10, " ");
    const totalMulta = formatNumber(somaMultaCalculada).padStart(10, " ");
    const desconto = "0,00".padStart(10, " ");
    const totalHonorarios = formatNumber(somaHonorariosCalculado).padStart(10, " ");
    const totalGeral = formatNumber(somaTotal).padStart(10, " ");

    const messageTotais = `${totalSaldo} ${totalJuros} ${totalMulta} ${desconto} ${totalHonorarios} ${totalGeral}`;

    const sumMessageTotais = `
                                   ---------- ---------- ---------- ---------- ---------- ----------
${messageTotais}
`;

    const bottomMessage = `
  
\nINCLUÍDO POR: API CHATBOT EM ${currentDateFormat} ${currentTimeFormat}.
---------------------------------------------------------------------------`;

    return (message + dynamicMessage + sumMessageTotais + bottomMessage).trimStart();
  };

  const mensagem = insertMessageAcordo();
  // console.log(mensagem);

  let periodo;

  if (plano === 1) {
    periodo = 1;
  } else {
    periodo = 7;
  }

  return {
    iddevedor,
    inclusao: `'${currentDate}'`,
    descricao: `'${mensagem}'`,
    plano,
    dataacordo: `'${currentDate}'`,
    codexcecao: null,
    contrato: null,
    documento: null,
    idcredor,
    codcli: null,
    codcobradora: null,
    valoroperacao: total_geral,
    dataentrada: null,
    responsavel: "'API CHATBOT'",
    hora: `'${currentTime}'`,
    database1: `'${ultimaDataVencimento}'`,
    juros: juros_percentual,
    honorarios: honorarios_percentual,
    multa: multa_percentual,
    idforma: 1,
    situacao: 1,
    idcampanha: 0,
    desconto: 0,
    autorizante: "''",
    margem: "'C'",
    periodo,
    retencao: null,
    idresponsavel: null,
    tipocampanha: "'N'",
    arquivo: null,
    enviado: "'N'",
    data_cancela: null,
    boletagem: 0,
    taxa_boleto: tarifa_boleto,
    idtiponegociacao: 15,
  };
}

function parseDadosPromessa(props) {
  const { idacordo, iddevedor, plano } = props;

  return {
    responsavel: "API CHATBOT",
    data: "",
    valor: 0,
    iddevedor,
    sistema: "API",
    tipo: "BOLETO",
    mensagem: "",
    situacao: 1,
    alteracao: null,
    respalteracao: "",
    parcela: 0,
    codigo: 0,
    idacordo,
    plano,
    idresponsavel: 111,
    email: "N",
    idemail: null,
    idstatus_cartao: null,
  };
}

async function criarPromessas(parsedData2, responseDividasCredores, parcelasArray, plano) {
  let contratos = "";
  const contratosIncluidos = new Set();

  responseDividasCredores.forEach((dividas, index) => {
    const { contrato, indice } = dividas;

    // Verifica se o contrato já foi incluído na lista.
    if (!contratosIncluidos.has(contrato)) {
      contratos += contrato;
      contratosIncluidos.add(contrato); // Adiciona o contrato ao Set.

      // Verifica se não é o último contrato antes de adicionar a barra "/".
      if (index !== responseDividasCredores.length - 1) {
        contratos += " / ";
      }
    }
  });

  const contratosDividas = contratos;

  const promises = [];
  let parcelaNumber = 0;

  for await (const parcela of parcelasArray) {
    parcelaNumber += 1;

    const dataPromessa = {
      ...parsedData2,
      data: parcela.vencimento.toISOString().slice(0, 10),
      valor: parseFloat(parcela.valorParcelaAtual),
      parcela: parcelaNumber,
    };

    dataPromessa.mensagem = `Parcela(s) ${parcelaNumber}/${plano} de acordo referente ao(s) título(s): ${contratos}
  Sr(a). Caixa:
  Não receber após o vencimento.
  Não receber valor inferior ao valor facial deste boleto, sem autorização do cedente.
  Sr (a). Cliente:
  A utilização deste boleto é obrigatória para adequada confirmação do pagamento.
  Depósito na conta corrente, sem a devida autorização do cedente, não garante a quitação do débito.
  `;

    // console.log(dataPromessa.mensagem);

    const promise = await requests.postDadosPromessa(dataPromessa);
    promises.push(promise);
  }

  return promises;
}

function parseDadosRecibo(props) {
  const {
    cpfcnpj,
    idacordo,
    iddevedor,
    idcredor,
    ultimaDataVencimento,
    plano,
    honorarios_percentual,
    juros_percentual,
    comissao_comercial,
    idcomercial,
    idgerente_comercial,
    chave,
    empresa,
    percentual_comissao_cobrador,
    idoperacao,
    idempresa,
  } = props;

  return {
    cpfcnpj,
    idacordo,
    iddevedor,
    idcredor,
    database1: ultimaDataVencimento,
    plano,
    honorarios_percentual,
    juros_percentual,
    comissao: comissao_comercial,
    idcomercial,
    idgerentecomercial: idgerente_comercial,
    chave,
    empresa,
    percentual_comissao_cobrador,
    idoperacao,
    idempresa,
    responsavel: "API CHATBOT",
  };
}

function parseDadosBoleto(props) {
  const {
    iddevedor,
    datavenc,
    valdoc,
    idcredor,
    cpfcnpj,
    plano,
    total_geral,
    valor_parcela,
    idcedente,
    ultimoIdAcordo,
    endres,
    baires,
    cidres,
    cepres,
    ufres,
    chave,
    contratosDividas,
  } = props;

  const dataVencFormat = formatDateInverse(datavenc);

  const messagemBoleto = `Parcela(s) 1/${plano} de acordo referente ao(s) título(s): ${contratosDividas}
  Sr(a). Caixa:
  Não receber após o vencimento.
  Não receber valor inferior ao valor facial deste boleto, sem autorização do cedente.
  Sr (a). Cliente:
  A utilização deste boleto é obrigatória para adequada confirmação do pagamento.
  Depósito na conta corrente, sem a devida autorização do cedente, não garante a quitação do débito.
  `;

  // console.log(messagemBoleto);

  return {
    iddevedor: `${iddevedor}`,
    DATAVENC: `'${dataVencFormat}'`,
    VALDOC: `${valdoc}`,
    ESPECIE: "'RC'",
    ACEITE: "'N'",
    IMP: "'N'",
    inclusao: `curdate()`,
    responsavel: "'API CHATBOT'",
    destino: "'e-mail'",
    email: `left(BuscaEmailConcat(${cpfcnpj}),100)`,
    chave: `${chave}`,
    sistema: "'COBRANCE'",
    hora: `curtime()`,
    enddestino: "''",
    idescritorio: "'PA'",
    idcredor: `${idcredor}`,
    idmodelo: 9,
    cpfcnpj: `${cpfcnpj}`,
    mensagem: `'${messagemBoleto}'`,
    idcedente: `${idcedente}`,
    boleto_idstatus: 1,
    idacordo: `${ultimoIdAcordo}`,
    endereco: `'${endres}'`,
    bairro: `'${baires}'`,
    cidade: `'${cidres}'`,
    cep: `'${cepres}'`,
    uf: `'${ufres}'`,
    parcela: 1,
  };
}

function parseDadosImagemBoleto(props) {
  const { idacordo, idboleto, banco } = props;

  return {
    idacordo,
    idboleto,
    banco,
  };
}

function parseDadosImagemQrCode(props) {
  const { idboleto } = props;

  return {
    idboleto,
  };
}

function parseDadosEmv(props) {
  const { idboleto } = props;

  return {
    idboleto,
  };
}

function handleCopyPix() {
  if (navigator.clipboard) {
    if (emvContent) {
      navigator.clipboard
        .writeText(emvContent)
        .then(() => {
          console.log("Valor copiado para a área de transferência:", emvContent);
          alert(`Valor copiado para a área de transferência: ${emvContent}`);
        })
        .catch((error) => {
          console.error("Erro ao copiar o valor:", error);
        });
    } else {
      console.error("O conteúdo a ser copiado (emvContent) não está definido.");
    }
  } else {
    // Fallback para navegadores que não suportam a API Clipboard
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = emvContent;

    // Adiciona o elemento ao DOM
    document.body.appendChild(tempTextArea);

    // Seleciona o texto
    tempTextArea.select();

    try {
      // Copia o texto para a área de transferência
      document.execCommand("copy");
      console.log("Valor copiado para a área de transferência:", emvContent);
      alert(`Valor copiado para a área de transferência: ${emvContent}`);
    } catch (error) {
      console.error("Erro ao copiar o valor:", error);
    } finally {
      // Remove o elemento temporário do DOM
      document.body.removeChild(tempTextArea);
    }
  }
}

async function saveQRCodeImageToLocal(url, idboleto) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("URL inválida");
    }

    const response = await fetch(url);

    // Verifica se a resposta está ok
    if (!response.ok) {
      throw new Error(`Erro ao baixar a imagem do QR Code. Status: ${response.status} - ${response.statusText}`);
    }

    const buffer = await response.buffer();
    fs.writeFileSync(`src/qrcodes/${idboleto}.png`, buffer);

    console.log("Imagem do QR Code salva localmente com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar imagem do QR Code localmente:", error);
  }
}

async function checkIfFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  formatValue,
  formatarMoeda,
  formatCredorOfertas,
  formatCredorInfo,
  formatCredorDividas,
  formatCredorAcordos,
  getCurrentDate,
  getCurrentTime,
  formatDateIsoToBr,
  getUltimaDataParcela,
  parseDadosAcordo,
  parseDadosPromessa,
  criarPromessas,
  parseDadosRecibo,
  parseDadosBoleto,
  parseDadosImagemBoleto,
  parseDadosImagemQrCode,
  parseDadosEmv,
  handleCopyPix,
  saveQRCodeImageToLocal,
  formatCodigoBoleto,
  formatCodigoPix,
  getCurrentDateTime,
  formatPhoneNumber,
  checkIfFileExists,
  getBrazilTimeFormatted,
};

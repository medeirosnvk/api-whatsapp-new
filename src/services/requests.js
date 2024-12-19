const axios = require("axios");
const utils = require("./utils");
const axiosApiInstance = require("../services/api").axiosApiInstance;

async function getAcordosFirmados(document) {
  const response = await axiosApiInstance.get(`/lista-acordos-firmados?documento=${document}`);

  return response.data;
}

async function getAcordosFirmadosDetalhado(idacordo) {
  const response = await axiosApiInstance.get(`/lista-acordos-firmados-detalhado?idacordo=${idacordo}`);

  return response.data;
}

async function getCredorDividas(iddevedor, dataBase) {
  const response = await axiosApiInstance.get(`/credores/dividas?iddevedor=${iddevedor}&database=${dataBase}`);

  return response.data;
}

async function getCredorDividasTotais(iddevedor, dataBase) {
  const response = await axiosApiInstance.get(`/credores/dividas/total?iddevedor=${iddevedor}&database=${dataBase}`);

  return response.data;
}

async function getCredorInfo(document) {
  const response = await axiosApiInstance.get(`/lista-credores?documento=${document}`);

  return response.data;
}

async function getCredorOfertas(iddevedor) {
  const response = await axiosApiInstance.get(`/credores/oferta-parcelas?iddevedor=${iddevedor}`);

  return response.data;
}

async function getCredorVerBoleto(iddevedor) {
  const response = await axiosApiInstance.get(`/credores/oferta-parcelas?iddevedor=${iddevedor}`);

  return response.data;
}

async function postDadosAcordo(props) {
  try {
    const { data } = await axiosApiInstance.post("/insert-acordo", props);
    return data;
  } catch (error) {
    const errorMessage = "Erro ao inserir dados do acordo";
    console.error(errorMessage, error);

    return { error: errorMessage };
  }
}

async function postDadosPromessa(props) {
  try {
    const { data } = await axiosApiInstance.post("/insert-promessa", props);
    return data;
  } catch (error) {
    const errorMessage = "Erro ao inserir promessa";
    console.error(errorMessage, error);

    return { error: errorMessage };
  }
}

async function postDadosRecibo(props) {
  try {
    const { data } = await axiosApiInstance.post("/insert-recibo/parcelado", props);
    return data;
  } catch (error) {
    const errorMessage = "Erro ao inserir dados do recibo";
    console.error(errorMessage, error);

    return { error: errorMessage };
  }
}

async function getAtualizarPromessas(idacordo) {
  try {
    const { data } = await axiosApiInstance.get(`/atualizar-valores-promessas?idacordo=${idacordo}`);
    return data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "erro ao buscar os dados" };
  }
}

async function getAtualizarValores(idacordo) {
  try {
    const { data } = await axiosApiInstance.get(`/atualizar-valores?idacordo=${idacordo}`);
    return data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "erro ao buscar os dados" };
  }
}

async function getDataValdoc(idacordo) {
  try {
    const { data } = await axiosApiInstance.get(`/lista-promessas-datavaldoc?idacordo=${idacordo}`);

    return data;
  } catch (error) {
    console.error("Erro ao buscar getDataValdoc no servidor: ", error);
    return { error: "Erro ao buscar getDataValdoc no servidor." };
  }
}

async function postDadosBoleto(props) {
  try {
    const { data } = await axiosApiInstance.post("/insert-boleto", props);
    return data;
  } catch (error) {
    const errorMessage = "Erro ao inserir dados do boleto";
    console.error(errorMessage, error);

    return { error: errorMessage };
  }
}

async function postBoletoFinal(
  credorInfo,
  ultimoIdAcordo,
  contratosDividas,
  iddevedor,
  idcredor,
  plano,
  total_geral,
  valor_parcela,
  comissao_comercial,
  idcomercial,
  idgerente_comercial,
  tarifa_boleto
) {
  if (!credorInfo.length && contratosDividas === "" && ultimoIdAcordo === "") {
    console.error("Informação faltando: credores, ultimoIdAcordo ou contratosDividas", credorInfo);
    return;
  }

  const currentDate = new Date().toISOString().slice(0, 10);

  const filterCredoresIdDevedor = await credorInfo.find((item) => item.iddevedor === iddevedor);

  const { endres, baires, cidres, cepres, ufres, chave, idcedente, cpfcnpj } = filterCredoresIdDevedor;

  const responseDataValdoc = await getDataValdoc(ultimoIdAcordo);

  if (responseDataValdoc[0].valdoc === null || responseDataValdoc[0].valdoc === "") {
    console.error("Informação faltando: responseDataValdoc", responseDataValdoc);
    return;
  }

  const { datavenc, valdoc } = responseDataValdoc[0];

  const parsedData5 = utils.parseDadosBoleto({
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
  });

  const responseBoleto = await postDadosBoleto(parsedData5);

  if (responseBoleto && Object.prototype.hasOwnProperty.call(responseBoleto, "error")) {
    console.error("Está faltando alguma coisa: ", { responseBoleto });
    return;
  }

  const data = {
    idcredor,
    cpfcnpj,
    comissao_comercial,
    idcomercial,
    idgerente_comercial,
    iddevedor,
    plano,
    total_geral,
    valor_parcela,
    tarifa_boleto,
    ultimoIdAcordo,
    dataacordo: currentDate,
  };

  return data;
}

async function getIdBoleto(idacordo) {
  try {
    const response = await axiosApiInstance.get(`/busca-idboleto?idacordo=${idacordo}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function postAtualizarValores(props) {
  try {
    const { data } = await axiosApiInstance.post("/atualizar-valores-boleto", props);
    return data;
  } catch (error) {
    const errorMessage = "Erro ao inserir dados do boleto";
    console.error(errorMessage, error);

    return { error: errorMessage };
  }
}

async function getImagemBoleto(props) {
  try {
    const { idacordo, idboleto, banco } = props;

    const response = await axiosApiInstance.get(`/busca-imagem-boleto?idacordo=${idacordo}&idboleto=${idboleto}&banco=${banco}`, {
      maxRedirects: 0, // Impede o Axios de seguir redirecionamentos
    });

    // Verifica se a resposta é um redirecionamento (código de status 302)
    if (response.status === 302) {
      // A nova URL estará no cabeçalho "Location" da resposta
      const newURL = response.headers.location;
      console.log(`Redirecionado para: ${newURL}`);

      // Trate o redirecionamento manualmente, fazendo outra solicitação para a nova URL, se necessário
      const responseImagemBoleto = await axios.get(newURL);
      return responseImagemBoleto.data;
    }
    // Se não for um redirecionamento, retorne os dados da resposta normalmente
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getImagemQrCode(props) {
  try {
    const { idboleto } = props;
    const response = await axiosApiInstance.get(`/busca-qrcode?idboleto=${idboleto}`, {
      maxRedirects: 0, // Impede o Axios de seguir redirecionamentos
    });

    // Verifica se a resposta é um redirecionamento (código de status 302)
    if (response.status === 302) {
      // A nova URL estará no cabeçalho "Location" da resposta
      const newURL = response.headers.location;
      console.log(`Redirecionado para: ${newURL}`);

      // Trate o redirecionamento manualmente, fazendo outra solicitação para a nova URL, se necessário
      const responseImageQrCode = await axios.get(newURL);
      return responseImageQrCode.data;
    }
    // Se não for um redirecionamento, retorne os dados da resposta normalmente
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getDataEmv(props) {
  try {
    const { idboleto } = props;
    const response = await axiosApiInstance.get(`/busca-emv?idboleto=${idboleto}`, {
      maxRedirects: 0, // Impede o Axios de seguir redirecionamentos
    });

    // Verifica se a resposta é um redirecionamento (código de status 302)
    if (response.status === 302) {
      // A nova URL estará no cabeçalho "Location" da resposta
      const newURL = response.headers.location;
      console.log(`Redirecionado para: ${newURL}`);

      // Trate o redirecionamento manualmente, fazendo outra solicitação para a nova URL, se necessário
      const responseImageQrCode = await axios.get(newURL);
      return responseImageQrCode.data;
    }
    // Se não for um redirecionamento, retorne os dados da resposta normalmente
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getDataBoletoPix(iddevedor) {
  try {
    const response = await axiosApiInstance.get(`/busca-boleto-pix?iddevedor=${iddevedor}`);
    console.log("getDataBoletoPix iddevedor -", iddevedor);
    console.log("getDataBoletoPix response -", getDataBoletoPix);

    return response.data;
  } catch (error) {
    console.error("Erro ao buscar getDataBoletoPix no servidor: ", error);
    return { error: "Erro ao buscar getDataBoletoPix no servidor." };
  }
}

async function getTicketStatusByPhoneNumber(phoneNumber) {
  try {
    const response = await axiosApiInstance.get(`/ticket-status-phone-number?phoneNumber=${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getAbrirAtendimentoBot(ticketId) {
  try {
    const response = await axiosApiInstance.get(`/atendimento-bot?id=${ticketId}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getAbrirAtendimentoHumano(ticketId) {
  try {
    const response = await axiosApiInstance.get(`/atendimento-humano-abrir?id=${ticketId}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getFecharAtendimentoHumano(ticketId) {
  try {
    const response = await axiosApiInstance.get(`/atendimento-humano-fechar?id=${ticketId}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getInserirNumeroCliente(phoneNumber) {
  try {
    const response = await axiosApiInstance.get(`/inserir-numero-cliente?phoneNumber=${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getInserirNovoTicket(phoneNumber) {
  try {
    const response = await axiosApiInstance.get(`/inserir-numero-ticket?phoneNumber=${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getStatusAtendimento(phoneNumber) {
  try {
    const response = await axiosApiInstance.get(`/status-atendimento?phoneNumber=${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

async function getCredorByPhoneNumber(phoneNumber) {
  try {
    const response = await axiosApiInstance.get(`/credor-db?phoneNumber=${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados no servidor: ", error);
    return { error: "Erro ao buscar dados no servidor." };
  }
}

module.exports = {
  getAcordosFirmados,
  getAcordosFirmadosDetalhado,
  getCredorDividas,
  getCredorDividasTotais,
  getCredorInfo,
  getCredorOfertas,
  getCredorVerBoleto,
  postDadosAcordo,
  postDadosPromessa,
  postDadosRecibo,
  getAtualizarPromessas,
  getAtualizarValores,
  postBoletoFinal,
  getIdBoleto,
  postAtualizarValores,
  getImagemBoleto,
  getImagemQrCode,
  getDataEmv,
  getDataBoletoPix,
  getTicketStatusByPhoneNumber,
  getAbrirAtendimentoBot,
  getAbrirAtendimentoHumano,
  getFecharAtendimentoHumano,
  getInserirNumeroCliente,
  getInserirNovoTicket,
  getStatusAtendimento,
  getCredorByPhoneNumber,
};

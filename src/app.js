/* eslint-disable indent */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const qrImage = require("qr-image");
const express = require("express");
const https = require("https");
const cors = require("cors");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { executeQuery } = require("./dbconfig");
const requests = require("./services/requests");
const utils = require("./services/utils");

let redirectSentMap = new Map();
let sessions = {};
let stateMachines = {};

const app = express();
const port = process.env.PORT;
const urlWebhook = process.env.URL_WEBHOOK;

const wwebVersion = "2.2412.54";
const qrCodeDataPath = path.join(__dirname, "qrcodes");
const clientDataPath = path.join(__dirname, "clientData.json");
const mediaDataPath = path.join(__dirname, "media");
const sessionDataPath = path.join(__dirname, "../.wwebjs_auth");
const customDbConfig = {
  host: process.env.DB2_MY_SQL_HOST,
  user: process.env.MY_SQL_USER,
  password: process.env.DB2_MY_SQL_PASSWORD,
  port: process.env.MY_SQL_PORT,
  database: process.env.DB2_MY_SQL_DATABASE,
  connectionLimit: parseInt(process.env.MY_SQL_CONNECTION_LIMIT),
  charset: process.env.MY_SQL_CHARSET,
  connectTimeout: 60000,
};

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("qrcodes"));

if (!fs.existsSync(qrCodeDataPath)) {
  fs.mkdirSync(qrCodeDataPath);
}

if (!fs.existsSync(mediaDataPath)) {
  fs.mkdirSync(mediaDataPath);
}

if (fs.existsSync(clientDataPath)) {
  sessions = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));
  // Atualiza o estado de todas as sessões para "disconnected"
  Object.keys(sessions).forEach((instanceName) => {
    sessions[instanceName].connectionState = "disconnected";
  });
  // Salva as alterações
  fs.writeFileSync(clientDataPath, JSON.stringify(sessions, null, 2));
}

process.on("uncaughtException", (err) => {
  console.error("Exceção Não Tratada:", err);
  // Opcional: Registrar o erro em um arquivo ou serviço de monitoramento
  // Exemplo: fs.appendFileSync('error.log', `Exceção Não Tratada: ${err.stack}\n`);
  process.exit(1); // Encerra o processo
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Rejeição de Promessa Não Tratada:", reason);

  if (reason.code === "ENOTEMPTY") {
    console.error("Diretório não está vazio. Tentando nova operação...");
  } else if (
    reason instanceof TypeError &&
    reason.message.includes(
      "Cannot read properties of undefined (reading 'AppState')"
    )
  ) {
    console.error(
      "Erro ao acessar propriedades indefinidas. Descartando operação..."
    );
  } else if (
    reason instanceof Error &&
    reason.message.includes(
      "Failed to add page binding with name onQRChangedEvent"
    )
  ) {
    console.error("Erro: O nome 'onQRChangedEvent' já existe. Ignorando...");
  } else if (
    reason instanceof Error &&
    reason.message.includes("window is not defined")
  ) {
    console.error(
      "Erro: O objeto 'window' não está disponível. Verifique o contexto de execução."
    );
  } else {
    // Registra a rejeição em um arquivo de log para análise posterior
    fs.appendFileSync(
      "error.log",
      `Rejeição de Promessa Não Tratada: ${reason}\n`
    );
  }
});

class StateMachine {
  constructor(client, sessionName) {
    this.userStates = {};
    this.globalData = {};
    this.connectedUsers = {};
    this.timer = {};
    this.client = client;
    this.ticketId = null;
    this.fromNumber = null;
    this.toNumber = null;
    this.sessionName = sessionName;
  }

  _setConnectedUsers(phoneNumber, ticketId) {
    if (this.connectedUsers && this.connectedUsers[phoneNumber]) {
      this.connectedUsers = {
        ...this.connectedUsers,
        [phoneNumber]: {
          algunsDadosQueTuQueira,
          ticketId: ticketId,
        },
      };
    } else {
      this.connectedUsers[phoneNumber] = {
        algunsDadosQueTuQueira,
        ticketId,
      };
    }
  }

  _setTicketId(ticketId) {
    this.ticketId = ticketId;
  }

  _setFromNumber(from) {
    this.fromNumber = from;
  }

  _setToNumber(to) {
    this.toNumber = to;
  }

  _setDataMenu(phoneNumber, data) {
    this.userStates[phoneNumber].data.MENU = data;
  }

  _setDataCredores(phoneNumber, data) {
    if (!this.userStates[phoneNumber].data) {
      this.userStates[phoneNumber].data = {}; // Inicializa o objeto se não existir
    }
    this.userStates[phoneNumber].data.CREDORES = data;
  }

  _setDataCredorSelecionado(phoneNumber, data) {
    // Verifica se o objeto userStates existe para o número de telefone
    if (!this.userStates[phoneNumber]) {
      this.userStates[phoneNumber] = {}; // Inicializa o objeto se estiver indefinido
    }

    // Verifica se o objeto data existe dentro de userStates[phoneNumber]
    if (!this.userStates[phoneNumber].data) {
      this.userStates[phoneNumber].data = {}; // Inicializa o objeto data se estiver indefinido
    }

    // Agora é seguro definir a propriedade CREDOR_SELECIONADO
    this.userStates[phoneNumber].data.CREDOR_SELECIONADO = data;
  }

  _setDataCredorDividas(phoneNumber, data) {
    this.userStates[phoneNumber].data.CREDOR_DIVIDAS = data;
  }

  _setDataOferta(phoneNumber, data) {
    this.userStates[phoneNumber].data.OFERTA = data;
  }

  _setDataPromessas(phoneNumber, data) {
    this.userStates[phoneNumber].data.PROMESSAS = data;
  }

  _setDataBoleto(phoneNumber, data) {
    this.userStates[phoneNumber].data.BOLETO = data;
  }

  _setCredor(phoneNumber, credor) {
    this.userStates[phoneNumber].credor = credor;
  }

  _setCurrentState(phoneNumber, newState) {
    if (!this.userStates[phoneNumber]) {
      this.userStates[phoneNumber] = { currentState: "INICIO" };
    }

    console.log("Estado anterior:", this.userStates[phoneNumber].currentState);
    console.log("SALVANDO NOVO ESTADO...", newState);
    this.userStates[phoneNumber].currentState = newState;
    console.log(
      "Estado atualizado:",
      this.userStates[phoneNumber].currentState
    );
  }

  _getCredor(phoneNumber) {
    return this.userStates[phoneNumber].credor;
  }

  _getState(phoneNumber) {
    if (this.userStates[phoneNumber]) {
      return this.userStates[phoneNumber];
    }

    this.userStates[phoneNumber] = {
      currentState: "INICIO",
      credor: {},
      data: {
        CREDOR: {},
        OFERTA: {},
      },
    };

    return this.userStates[phoneNumber];
  }

  _resetUserState(phoneNumber) {
    delete this.userStates[phoneNumber];
  }

  async _postMessage(origin, body) {
    console.log(`Horário da mensagem ENVIADA ao cliente: ${new Date()}`);

    const demim = 1;

    if (typeof body === "string") {
      await this._getRegisterMessagesDB(
        this.toNumber,
        this.fromNumber,
        body,
        this.ticketId,
        demim
      );

      await this.client.sendMessage(origin, body);
    } else {
      await this.client.sendMessage(origin, body);
    }
  }

  async _getCredorFromDB(phoneNumber) {
    try {
      if (!this.userStates[phoneNumber]) {
        this.userStates[phoneNumber] = {}; // Inicialize o objeto se não existir
      }

      const query = `
        select
          d.iddevedor,
          d.cpfcnpj,
          d.nome,
          t.telefone,
          t.idtelefones,
          d.idusuario
        from
          statustelefone s,
          telefones2 t,
          devedor d ,
          credor c
        where
          right(t.telefone,8) = '${phoneNumber}'
          and d.cpfcnpj = t.cpfcnpj
          and d.idusuario not in (11, 14)
          and s.idstatustelefone = t.idstatustelefone
          and s.fila = 's'
          and c.idcredor = d.idcredor
          and c.libera_api_acordo = 's'
      `;

      const dbResponse = await executeQuery(query, customDbConfig);

      if (dbResponse && dbResponse.length) {
        for (const credor of dbResponse) {
          const liberaApiQuery = `select libera_api(${credor.iddevedor}) as liberaApi;`;
          const liberaApiResponse = await executeQuery(
            liberaApiQuery,
            customDbConfig
          );

          // Se o liberaApiResponse retornar 'S' retorne o primeiro credor
          if (
            liberaApiResponse &&
            liberaApiResponse.length &&
            liberaApiResponse[0].liberaApi === "S"
          ) {
            console.log(`Libera API encontrada para o número ${phoneNumber}.`);
            this._setCredor(phoneNumber, dbResponse[0]);
            return dbResponse[0];
          }
        }

        // Se nenhum valor de liberaApi for encontrado, retorna null
        console.log(
          `Nenhuma liberação de API encontrada para o número ${phoneNumber}.`
        );
        return null;
      } else {
        console.log(`Nenhum credor encontrado para o número ${phoneNumber}.`);
        return null;
      }
    } catch (error) {
      console.error(
        `Erro ao buscar credor para o número ${phoneNumber}:`,
        error
      );
      throw error;
    }
  }

  async _getTicketStatusDB(phoneNumber) {
    if (!this.userStates[phoneNumber]) {
      this.userStates[phoneNumber] = {}; // inicialize o objeto se não existir
    }

    const dbQuery = `
    select
      bt.id,
      bot_idstatus,
      bot_contato_id,
      idresponsavel,
      bt.inclusao,
      encerrado
    from
      bot_ticket bt,
      bot_contato bc
    where
      bc.telefone = ${phoneNumber}
      and bc.id = bt.bot_contato_id
    `;

    const dbResponse = await executeQuery(dbQuery, customDbConfig);

    return dbResponse;
  }

  async _getInsertClientNumberDB(phoneNumber) {
    if (!this.userStates[phoneNumber]) {
      this.userStates[phoneNumber] = {}; // inicialize o objeto se não existir
    }

    const dbQuery = `
    INSERT ignore INTO
      cobrance.bot_contato (
        telefone
      ) 
    VALUES(
      ${phoneNumber}
    )`;

    const dbResponse = await executeQuery(dbQuery, customDbConfig);

    return dbResponse;
  }

  async _getInsertTicketDB(phoneNumber) {
    if (!this.userStates[phoneNumber]) {
      this.userStates[phoneNumber] = {}; // inicialize o objeto se não existir
    }

    const dbQuery = `
    insert into
      bot_ticket (
        bot_idstatus,
        bot_contato_id,
        idresponsavel
    )
    values(
      1,
      (select id from bot_contato bc where telefone =${phoneNumber}),
      1
    )`;

    const dbResponse = await executeQuery(dbQuery, customDbConfig);

    return dbResponse;
  }

  async _getRegisterMessagesDB(from, to, message, ticketId, demim) {
    if (!this.userStates[from]) {
      this.userStates[from] = {}; // inicialize o objeto se não existir
    }

    const formatDateTime = utils.getCurrentDateTime();
    const formatFromNumber = utils.formatPhoneNumber(from);
    const formatToNumber = utils.formatPhoneNumber(to);

    const dbQuery = `
      INSERT INTO
      bot_mensagens(
        de,
        para,
        mensagem,
        data_hora,
        bot_ticket_id,
        demim
      )
      values(
        '${formatFromNumber}',
        '${formatToNumber}',
        '${message}',
        '${formatDateTime}',
        '${ticketId}',
        '${demim}'
      )
    `;

    const dbResponse = await executeQuery(dbQuery, customDbConfig);

    return dbResponse;
  }

  async _getWhaticketStatus(phoneNumber) {
    const dbQuery = `
    SELECT DISTINCT c.*, t.*,
    (SELECT m.fromMe FROM Messages m WHERE m.ticketId = t.id ORDER BY m.createdAt DESC LIMIT 1) AS fromMe,
    (SELECT m.body FROM Messages m WHERE m.ticketId = t.id ORDER BY m.createdAt DESC LIMIT 1) AS body
    FROM Tickets t
    LEFT JOIN Contacts c ON c.id = t.contactId
    WHERE status = 'pending' AND LENGTH(c.number) <= 15 AND c.number = '${phoneNumber}'
    HAVING fromMe = 0;
    `;

    const dbResponse = await executeQuery(dbQuery);

    if (dbResponse && dbResponse.length) {
      return dbResponse;
    }

    throw new Error("Something não encontrado");
  }

  async _handleErrorState(origin, phoneNumber, errorMessage) {
    await this._postMessage(origin, errorMessage);
    await this._resetUserState(phoneNumber);
    await this._handleInitialState(origin, phoneNumber);
  }

  async _handleInitialState(origin, phoneNumber, response) {
    const credor = await this._getCredorFromDB(phoneNumber);

    if (!credor || credor.length === 0) {
      console.log(
        "Credor sem cadastro no banco de dados. Atendimento chatbot não iniciado para -",
        phoneNumber
      );
      return;
    }

    const message = `Olá *${credor.nome}*,\n\nPor favor, escolha uma opção:\n\n*1)* Ver Dívidas\n*2)* Ver Acordos\n*3)* Linha Digitável\n*4)* Pix Copia e Cola`;
    await this._postMessage(origin, message);
  }

  async _handleMenuState(origin, phoneNumber, response) {
    const initialStateResponse = response.body.trim();
    switch (initialStateResponse) {
      case "1":
        try {
          const { cpfcnpj: document } = this._getCredor(phoneNumber);
          const credorInfo = await requests.getCredorInfo(document);

          if (!credorInfo || credorInfo.length === 0) {
            const messageErro =
              "Você não possui dívidas ou ofertas disponíveis.";
            await this._postMessage(origin, messageErro);
            await this._handleInitialState(origin, phoneNumber, response);
          } else if (credorInfo && credorInfo.length === 1) {
            const credorMessage = utils.formatCredorInfo(credorInfo);
            const messageSucess = `${credorMessage}`;

            await this._postMessage(origin, messageSucess);
            this._setCurrentState(phoneNumber, "CREDOR");
            await this._handleCredorState(origin, phoneNumber, response);
          } else {
            const credorMessage = utils.formatCredorInfo(credorInfo);
            const messageSucess = `${credorMessage}\n\n_Selecione o numero da divida a negociar._`;

            await this._postMessage(origin, messageSucess);
            this._setCurrentState(phoneNumber, "CREDOR");
          }
        } catch (error) {
          console.error("Case 1 retornou um erro - ", error.message);
          await this._handleErrorState(
            origin,
            phoneNumber,
            "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
          );
        }
        break;

      case "2":
        try {
          await this._handleAcordoState(origin, phoneNumber); // Passando o phoneNumber como argumento
        } catch (error) {
          console.error("Case 2 retornou um erro - ", error.message);
          await this._handleErrorState(
            origin,
            phoneNumber,
            "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
          );
        }
        break;

      case "3":
        try {
          await this._handleBoletoState(origin, phoneNumber, response); // Passando o phoneNumber e response como argumentos
        } catch (error) {
          console.error("Case 3 retornou um erro - ", error.message);
          await this._handleErrorState(
            origin,
            phoneNumber,
            "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
          );
        }
        break;

      case "4":
        try {
          await this._handlePixState(origin, phoneNumber, response); // Passando o phoneNumber e response como argumentos
        } catch (error) {
          console.error("Case 4 retornou um erro - ", error.message);
          await this._handleErrorState(
            origin,
            phoneNumber,
            "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
          );
        }
        break;
    }
  }

  async _handleCredorState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = this._getCredor(phoneNumber);
      const credorInfo = await requests.getCredorInfo(document);

      if (Array.isArray(credorInfo) && credorInfo.length > 0) {
        let selectedCreditor;

        if (credorInfo.length === 1) {
          selectedCreditor = credorInfo[0];
        } else if (credorInfo.length > 1) {
          const selectedOption = parseInt(response.body.trim());
          this._setDataCredores(phoneNumber, credorInfo);

          if (selectedOption >= 1 && selectedOption <= credorInfo.length) {
            selectedCreditor = credorInfo[selectedOption - 1];
          } else {
            // Mantém o estado atual como "MENU" e não altera para "INICIO"
            // this._setCurrentState(phoneNumber, "MENU");

            await this._postMessage(
              origin,
              "Resposta inválida. Por favor, tente novamente."
            );
            return;
          }
        }

        if (selectedCreditor) {
          this._setDataCredorSelecionado(phoneNumber, selectedCreditor);

          const idDevedor = selectedCreditor.iddevedor;
          const dataBase = utils.getCurrentDate();

          const [credorDividas, credorOfertas] = await Promise.all([
            requests.getCredorDividas(idDevedor, dataBase),
            requests.getCredorOfertas(idDevedor),
          ]);

          this._setDataCredorDividas(phoneNumber, credorDividas);

          const formattedResponseDividas =
            utils.formatCredorDividas(credorDividas);
          const formattedResponseOfertas =
            utils.formatCredorOfertas(credorOfertas);

          const terceiraMensagem = `As seguintes dívidas foram encontradas para a empresa selecionada:\n\n${formattedResponseDividas}\n\n*Escolha uma das opções abaixo para prosseguirmos no seu acordo:*\n\n${formattedResponseOfertas}`;

          await this._postMessage(origin, terceiraMensagem);
          this._setCurrentState(phoneNumber, "OFERTA");
        }
      } else {
        await this._postMessage(
          origin,
          "Não foi possível encontrar informações para o documento fornecido."
        );
      }
    } catch (error) {
      console.error("Erro ao lidar com o estado do credor:", error);
      await this._postMessage(
        origin,
        "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde."
      );
    }
  }

  async _handleOfertaState(origin, phoneNumber, response) {
    try {
      if (response && response.body.trim().match(/^\d+$/)) {
        const selectedOptionParcelamento = parseInt(response.body.trim());

        const credorByPhone = await requests.getCredorByPhoneNumber(
          phoneNumber
        );

        const { cpfcnpj } = credorByPhone[0];
        const credorInfo = await requests.getCredorInfo(cpfcnpj);
        const {
          comissao_comercial,
          idcomercial,
          idgerente_comercial,
          iddevedor,
        } = credorInfo[0];

        const credorOfertas = await requests.getCredorOfertas(iddevedor);

        if (
          selectedOptionParcelamento >= 1 &&
          selectedOptionParcelamento <= credorOfertas.length
        ) {
          await this._postMessage(
            origin,
            "Aguarde, estamos gerando o seu acordo..."
          );

          const ofertaSelecionada =
            credorOfertas[selectedOptionParcelamento - 1];
          this._setDataOferta(phoneNumber, ofertaSelecionada);

          const { periodicidade, valor_parcela, plano, idcredor, total_geral } =
            ofertaSelecionada;

          const ultimaDataParcela = utils.getUltimaDataParcela(
            periodicidade,
            valor_parcela,
            plano
          );

          const { parcelasArray, ultimaData } = ultimaDataParcela;
          const ultimaDataFormat = ultimaData.toISOString().slice(0, 10);

          const currentDate = new Date();
          const currentTime = utils.getCurrentTime();

          const newDataBase =
            currentDate.getDate() + parseInt(plano) * periodicidade;
          const formattedDate = newDataBase.toString().substring(0, 10);

          const { data: promessas } = await requests.getCredorDividas(
            iddevedor,
            formattedDate
          );

          const obj = {
            promessas,
            ultimaDataVencimento: ultimaData.toISOString().slice(0, 10),
            vencimentosParcelas: parcelasArray,
          };

          this._setDataPromessas(phoneNumber, obj);

          const responseDividasCredores = await requests.getCredorDividas(
            iddevedor,
            ultimaDataFormat
          );

          const responseDividasCredoresTotais =
            await requests.getCredorDividasTotais(iddevedor, ultimaDataFormat);

          const {
            juros_percentual,
            honorarios_percentual,
            multa_percentual,
            tarifa_boleto,
          } = responseDividasCredoresTotais;

          const parsedData = utils.parseDadosAcordo({
            currentTime,
            honorarios_percentual,
            idcredor,
            iddevedor: iddevedor,
            juros_percentual,
            multa_percentual,
            plano,
            responseDividasCredores,
            tarifa_boleto,
            total_geral,
            ultimaDataVencimento: ultimaDataFormat,
            parcelasArray,
          });

          const idacordo = await requests.postDadosAcordo(parsedData);

          const parsedData2 = utils.parseDadosPromessa({
            idacordo,
            iddevedor: iddevedor,
            plano,
          });

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

            const promise = await requests.postDadosPromessa(dataPromessa);
            promises.push(promise);
          }

          const responsePromessas = await Promise.all(promises);

          const [ultimoIdPromessa] = responsePromessas.slice(-1);

          const { chave, empresa } = credorInfo[0];
          const { percentual_comissao_cobrador, idoperacao, idempresa } =
            responseDividasCredores[0];

          const parsedData3 = utils.parseDadosRecibo({
            comissao_comercial,
            cpfcnpj: cpfcnpj,
            honorarios_percentual,
            idacordo,
            iddevedor,
            idcredor,
            idcomercial,
            idgerente_comercial,
            juros_percentual,
            plano,
            ultimaDataVencimento: ultimaDataFormat,
            ultimoIdPromessa,
            chave,
            empresa,
            percentual_comissao_cobrador,
            idoperacao,
            idempresa,
          });

          const responseRecibo = await requests.postDadosRecibo(parsedData3);

          if (
            responseRecibo &&
            Object.prototype.hasOwnProperty.call(responseRecibo, "error")
          ) {
            console.error(responseRecibo.error);
            setErrorMessage("Erro ao receber responseRecibo.");
            return;
          }

          await requests.getAtualizarPromessas(idacordo);
          await requests.getAtualizarValores(idacordo);

          const responseBoleto = await requests.postBoletoFinal(
            credorInfo,
            idacordo,
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
          );

          this._setDataBoleto(phoneNumber, responseBoleto);

          const responseIdBoleto = await requests.getIdBoleto(idacordo);

          const { idboleto } = responseIdBoleto[0];
          const { banco } = responseIdBoleto[0];
          const { convenio } = responseIdBoleto[0];

          const updateValoresBoleto = await requests.postAtualizarValores({
            idboleto,
            banco,
            convenio,
          });

          if (
            updateValoresBoleto &&
            Object.prototype.hasOwnProperty.call(updateValoresBoleto, "error")
          ) {
            console.error("Erro ao atualizar valores de nossoNum e numDoc: ", {
              updateValoresBoleto,
            });
            setErro("Erro ao atualizar valores de nossoNum e numDoc.");
            return;
          }

          const parsedData4 = utils.parseDadosImagemBoleto({
            idacordo,
            idboleto,
            banco,
          });

          const responseBoletoContent = await requests.getImagemBoleto(
            parsedData4
          );

          const parsedData5 = utils.parseDadosImagemQrCode({ idboleto });

          const responseQrcodeContent = await requests.getImagemQrCode(
            parsedData5
          );

          await utils.saveQRCodeImageToLocal(
            responseQrcodeContent.url,
            idboleto
          );

          const media = MessageMedia.fromFilePath(
            `src/qrcodes/${idboleto}.png`
          );

          // Verifique se a imagem foi salva corretamente
          const imageExists = await utils.checkIfFileExists(
            `src/qrcodes/${idboleto}.png`
          );
          console.log("A imagem foi salva corretamente:", imageExists);

          const mensagemAcordo = `*ACORDO REALIZADO COM SUCESSO!*\n\nPague a primeira parcela através do QRCODE ou link do BOLETO abaixo:\n\nhttp://cobrance.com.br/acordo/boleto.php?idboleto=${responseBoletoContent.idboleto}&email=2`;

          const mensagemRecibo =
            "*ATENÇÃO! CONFIRA SEUS DADOS E VALOR NA HORA DO PAGAMENTO!*\n\nPor favor, nos envie o *comprovante* assim que possivel para registro! Atendimento finalizado, obrigado e bons negócios.";

          try {
            await this._postMessage(origin, mensagemAcordo);
            await this._postMessage(origin, media);
            await this._postMessage(origin, mensagemRecibo);

            const date = new Date();
            const formattedDateTime = utils.getBrazilTimeFormatted(date);

            console.log(
              `ACORDO FECHADO! IdDevedor - ${iddevedor} IdAcordo - ${idacordo} para o nº ${phoneNumber} em ${formattedDateTime}`
            );

            await requests.getFecharAtendimentoHumano(this.ticketId);
          } catch (error) {
            console.error(
              "Erro ao enviar as mensagens: mensagemAcordo, media e mensagemRecibo",
              error
            );
          }
        } else {
          // Resposta inválida, informar o usuário
          await this._postMessage(
            origin,
            "Resposta inválida. Por favor, escolha uma opção válida."
          );
          this._setCurrentState(phoneNumber, "OFERTA"); // Mantém o estado OFERTA
        }
      } else {
        // Resposta não numérica, informar o usuário
        await this._postMessage(
          origin,
          "Resposta inválida. Por favor, escolha uma opção válida."
        );
        this._setCurrentState(phoneNumber, "OFERTA"); // Mantém o estado OFERTA
      }
    } catch (error) {
      console.error("Erro ao lidar com o estado de oferta:", error);
    }
  }

  async _handleAcordoState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = await this._getCredorFromDB(phoneNumber);

      const acordosFirmados = await requests.getAcordosFirmados(document);

      if (!acordosFirmados || acordosFirmados.length === 0) {
        const message = "Você não possui acordos efetuados a listar.";
        await this._postMessage(origin, message);
        await this._handleInitialState(origin, phoneNumber, response);
      } else {
        const formatAcordos = utils.formatCredorAcordos(acordosFirmados);

        const message = `*Os seguintes acordos firmados foram encontrados:*\n\n${formatAcordos}`;
        await this._postMessage(origin, message);
        await this._handleInitialState(origin, phoneNumber, response);
      }
    } catch (error) {
      console.error("Case 2 retornou um erro - ", error.message);
      await this._handleErrorState(
        origin,
        phoneNumber,
        "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
      );
    }
  }

  async _handleBoletoState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = await this._getCredorFromDB(phoneNumber);

      const acordosFirmados = await requests.getAcordosFirmados(document);

      if (!acordosFirmados || acordosFirmados.length === 0) {
        const message =
          "Você não possui acordos nem Linhas Digitáveis a listar.";
        await this._postMessage(origin, message);
        await this._handleInitialState(origin, phoneNumber, response);
      } else {
        const responseBoletoPixArray = [];

        for (const acordo of acordosFirmados) {
          const iddevedor = acordo.iddevedor;

          try {
            const responseBoletoPix = await requests.getDataBoletoPix(
              iddevedor
            );
            responseBoletoPixArray.push(responseBoletoPix);
            console.log(
              `responseBoletoPix executado para ${iddevedor} com resposta ${responseBoletoPix}`
            );
          } catch (error) {
            console.error(
              "Erro ao obter dados do boleto para iddevedor",
              iddevedor,
              ":",
              error.message
            );
            await this._handleErrorState(
              origin,
              phoneNumber,
              "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
            );
            return;
          }
        }

        if (acordosFirmados.length > 0 && responseBoletoPixArray.length === 0) {
          await this._postMessage(origin, "Boleto vencido ou não disponível.");
          await this._handleInitialState(origin, phoneNumber, response);
        } else if (
          responseBoletoPixArray.length === 1 &&
          responseBoletoPixArray[0].length === 0
        ) {
          await this._postMessage(origin, "Boleto vencido ou não disponível.");
          await this._handleInitialState(origin, phoneNumber, response);
        } else {
          const formatBoletoPixArray = utils.formatCodigoBoleto(
            responseBoletoPixArray
          );
          const message = `${formatBoletoPixArray}`;
          await this._postMessage(origin, message);
          await this._handleInitialState(origin, phoneNumber, response);
        }
      }
    } catch (error) {
      console.error("Case 3 retornou um erro - ", error.message);
      await this._handleErrorState(
        origin,
        phoneNumber,
        "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
      );
    }
  }

  async _handlePixState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = await this._getCredorFromDB(phoneNumber);

      const acordosFirmados = await requests.getAcordosFirmados(document);

      if (!acordosFirmados || acordosFirmados.length === 0) {
        const message = "Você não possui acordos nem Códigos PIX a listar.";
        await this._postMessage(origin, message);
        await this._handleInitialState(origin, phoneNumber, response);
      } else {
        const responseBoletoPixArray = [];

        for (const acordo of acordosFirmados) {
          const iddevedor = acordo.iddevedor;

          try {
            const responseBoletoPix = await requests.getDataBoletoPix(
              iddevedor
            );
            responseBoletoPixArray.push(responseBoletoPix);
            console.log(
              `responseBoletoPix executado para ${iddevedor} com resposta ${responseBoletoPix}`
            );
          } catch (error) {
            console.error(
              "Erro ao obter dados do boleto para iddevedor",
              iddevedor,
              ":",
              error.message
            );
            await this._handleErrorState(
              origin,
              phoneNumber,
              "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
            );
            return;
          }
        }

        // Verificar se acordosFirmados tem dados e responseBoletoPixArray está vazio ou indefinido
        if (acordosFirmados.length > 0 && responseBoletoPixArray.length === 0) {
          await this._postMessage(
            origin,
            "Código PIX vencido ou não disponível."
          );
          await this._handleInitialState(origin, phoneNumber, response);
        } else if (
          responseBoletoPixArray.length === 1 &&
          responseBoletoPixArray[0].length === 0
        ) {
          await this._postMessage(
            origin,
            "Código PIX vencido ou não disponível."
          );
          await this._handleInitialState(origin, phoneNumber, response);
        } else {
          const formatBoletoPixArray = utils.formatCodigoPix(
            responseBoletoPixArray
          );

          const message = `${formatBoletoPixArray}`;
          await this._postMessage(origin, message);
          await this._handleInitialState(origin, phoneNumber, response);
        }
      }
    } catch (error) {
      console.error("Case 4 retornou um erro - ", error.message);
      await this._handleErrorState(
        origin,
        phoneNumber,
        "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente."
      );
    }
  }

  async handleMessage(phoneNumber, response) {
    try {
      let { currentState } = this._getState(phoneNumber);
      const origin = response.from;

      if (!currentState) {
        currentState = "INICIO";
      }

      console.log(
        `[Sessão: ${this.sessionName} - Número: ${phoneNumber} - Estado: ${currentState}]`
      );

      switch (currentState) {
        case "INICIO":
          await this._handleInitialState(origin, phoneNumber, response);
          this._setCurrentState(phoneNumber, "MENU");
          break;
        case "MENU":
          await this._handleMenuState(origin, phoneNumber, response);
          break;
        case "CREDOR":
          await this._handleCredorState(origin, phoneNumber, response);
          this._setCurrentState(phoneNumber, "OFERTA");
          break;
        case "OFERTA":
          await this._handleOfertaState(origin, phoneNumber, response);
          this._setCurrentState(phoneNumber, "INICIO");
          break;
        case "VER_ACORDOS":
          await this._handleAcordoState(origin, phoneNumber, response);
          this._setCurrentState(phoneNumber, "INICIO");
          break;
        case "VER_LINHA_DIGITAVEL":
          await this._handleBoletoState(origin, phoneNumber, response);
          this._setCurrentState(phoneNumber, "INICIO");
          break;
        case "VER_CODIGO_PIX":
          await this._handlePixState(origin, phoneNumber, response);
          this._setCurrentState(phoneNumber, "INICIO");
          break;
      }
    } catch (error) {
      if (error.message.includes("Nao existe atendimento registrado")) {
        console.error("Erro ao criar um novo ticket:", error);
      } else {
        console.error("Erro ao verificar o status do serviço:", error);
      }
    }
  }
}

const initializeConnectionStatus = () => {
  Object.keys(sessions).forEach((sessionName) => {
    const state = getConnectionStatus(sessionName);
    sessions[sessionName].connectionState = state;
  });

  // Salvar as atualizações de volta para clientData.json
  fs.writeFileSync(clientDataPath, JSON.stringify(sessions, null, 2), "utf8");
};

const updateSessionStatus = (sessionName, status) => {
  sessions[sessionName].connectionState = status;

  // Salvar as atualizações de volta para clientData.json
  fs.writeFileSync(clientDataPath, JSON.stringify(sessions, null, 2), "utf8");
};

const reconnectSession = async (sessionName) => {
  try {
    console.log(`Tentando reconectar a sessão ${sessionName}...`);
    createSession(sessionName);
    updateSessionStatus(sessionName, "connected"); // Atualiza o status para 'connected
  } catch (error) {
    console.error(`Falha ao conectar a sessão ${sessionName}:`, error);
    updateSessionStatus(sessionName, "disconnected"); // Atualiza o status para 'disconnected'
  }
};

const createSession = async (sessionName) => {
  if (sessions[sessionName]?.connectionState === "open") {
    console.log(`A instância ${sessionName} já está conectada.`);
    return;
  }

  let client;

  try {
    const localAuth = new LocalAuth({ clientId: sessionName });

    delete localAuth.logout;
    localAuth.logout = async () => {
      try {
        console.log("Executando logout...");

        if (this.userDataDir) {
          await fs.promises.rm(this.userDataDir, {
            recursive: true,
            force: true,
          });
          console.log(
            `Diretório de dados do usuário ${this.userDataDir} removido com sucesso.`
          );
        }
      } catch (error) {
        console.error(
          "Erro ao remover o diretório de dados do usuário:",
          error
        );
      }
    };

    client = new Client({
      authStrategy: localAuth,
      puppeteer: {
        headless: true,
        args: [
          "--no-default-browser-check",
          "--disable-session-crashed-bubble",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
        ],
      },
    });

    client.connectionState = "connecting";
    client.sessionName = sessionName;

    const qrTimeout = setTimeout(() => {
      if (client.connectionState !== "open") {
        client.connectionState = "disconnected";
        console.log(
          `Tempo esgotado para a sessão ${sessionName}. Desconectando...`
        );
        client.destroy();
      }
    }, 30 * 60 * 1000); // 30 minutos

    client.on("loading_screen", (percent, message) => {
      console.log("Carregando...", percent, message);
    });

    let isQRFunctionExposed = false;

    client.on("qr", async (qr) => {
      try {
        if (!isQRFunctionExposed) {
          console.log(`QR Code para a sessão ${sessionName}:`);
          qrcode.generate(qr, { small: true });
          await saveQRCodeImage(qr, sessionName);
          isQRFunctionExposed = true;
        }
      } catch (error) {
        console.error("Erro ao lidar com QR Code:", error.message);
      }
    });

    client.on("disconnected", async (data) => {
      try {
        console.log("DISCONNECTED -", JSON.stringify(data, undefined, 2));

        clearTimeout(qrTimeout);
        console.log(`Sessão ${sessionName} foi desconectada.`);

        await client.logout();
        client.connectionState = "disconnected";
      } catch (error) {
        console.error("Erro ao lidar com desconexão:", error.message);

        if (
          error.message.includes("Cannot read properties of undefined") ||
          error.message.includes("ENOTEMPTY") ||
          error.message.includes(
            "Protocol error (Runtime.callFunctionOn): Target closed"
          )
        ) {
          console.error(
            "Erro ao acessar propriedades indefinidas ou diretório não vazio durante a desconexão:",
            error.message
          );

          client.connectionState = "banned";
          saveClientData(client);
        } else {
          // Caso contrário, marque como desconectado
          client.connectionState = "disconnected";
          saveClientData(client);
        }
      }
    });

    client.on("authenticated", (data) => {
      console.log("AUTHENTICATED -", JSON.stringify(data, undefined, 2));
      clearTimeout(qrTimeout);

      // if (sessions && sessions[sessionName]) {
      //   console.log("SESSIONS JA EXISTE", sessionName);
      //   return;
      // }

      sessions[client.sessionName] = client;
      console.log(`Conexão bem-sucedida na sessão ${client.sessionName}!`);

      try {
        const stateMachine = new StateMachine(client, client.sessionName);
        stateMachines[client.sessionName] = stateMachine;
      } catch (error) {
        console.error("Erro ao criar StateMachine:", error);
      }
    });

    client.on("auth_failure", (data) => {
      console.log("AUTH_FAILURE -", JSON.stringify(data, undefined, 2));

      clearTimeout(qrTimeout);
      client.connectionState = "disconnected";
      console.error(
        `Falha de autenticação na sessão ${sessionName}. Verifique suas credenciais.`
      );

      if (data.includes("ban")) {
        client.connectionState = "banned";
        console.error(`A sessão ${client.sessionName} foi banida.`);
        sessions[sessionName].connectionState === "banned";
      } else {
        client.connectionState = "disconnected";
      }
    });

    client.on("ready", async () => {
      clearTimeout(qrTimeout);
      client.connectionState = "open";
      console.log(`Sessão ${sessionName} está pronta!`);

      const debugWWebVersion = await client.getWWebVersion();
      console.log(`WWebVersion = ${debugWWebVersion}`);

      client.pupPage.on("load", async (err) => {
        // console.log("loadError: " + err.toString());
      });

      client.pupPage.on("pageerror", function (err) {
        // console.log("pageError: " + err.toString());
      });

      client.pupPage.on("error", function (err) {
        // console.log("error: " + err.toString());
      });

      try {
        saveClientData(client);
        const stateMachine = new StateMachine(client, client.sessionName);
        stateMachines[client.sessionName] = stateMachine;
      } catch (error) {
        console.error("Erro ao criar arquivo clientData.json:", error);
      }
    });

    client.on("message", async (message) => {
      try {
        if (client.connectionState !== "open") {
          console.log(
            `Sessão ${sessionName} está desconectada. Ignorando mensagem.`
          );
          return;
        }

        console.log(
          `Sessão ${sessionName} recebeu a mensagem: ${message.body} de ${
            message.from
          } no horário ${new Date()}`
        );

        let mediaName = "";
        let mediaUrl = "";
        let mediaBase64 = "";
        let ticketId;
        let bot_idstatus;

        const stateMachine = stateMachines[sessionName];
        const { body, from, to } = message;

        if (!stateMachine) {
          console.error(
            `StateMachine não encontrada para a sessão ${sessionName}`
          );
          return;
        }

        const response = {
          from: message.from,
          body: message.body,
        };

        const fromPhoneNumber = utils.formatPhoneNumber(message.from);
        const webhookUrl =
          "http://www.cobrance.com.br/codechat/webhook_cobrance.php";

        if (message.hasMedia) {
          try {
            const media = await message.downloadMedia();
            const mediaPath = path.join(__dirname, "media", fromPhoneNumber);

            if (!fs.existsSync(mediaPath)) {
              fs.mkdirSync(mediaPath, { recursive: true });
            }

            const fileName = `${new Date().getTime()}.${
              media.mimetype.split("/")[1]
            }`;
            const filePath = path.join(mediaPath, fileName);

            fs.writeFileSync(filePath, media.data, "base64");
            console.log(`Arquivo recebido e salvo em: ${filePath}`);

            mediaName = fileName;
            mediaUrl = `${urlWebhook}/media/${fromPhoneNumber}/${fileName}`;
            mediaBase64 = media.data;
          } catch (error) {
            console.error(
              `Erro ao processar mídia para a sessão ${sessionName}:`,
              error
            );
          }
        }

        try {
          await axios.post(webhookUrl, {
            sessionName,
            message: {
              ...message,
              body: mediaName || message.body,
              mediaName,
              mediaUrl,
              mediaBase64,
            },
          });
        } catch (error) {
          console.error(
            `Erro ao enviar dados para o webhook para a sessão ${sessionName}:`,
            error
          );
        }

        if (!fromPhoneNumber || !response) {
          console.log("Mensagem inválida recebida", message.body);
          return;
        }

        try {
          const credorExistsFromDB = await stateMachine._getCredorFromDB(
            fromPhoneNumber
          );
          if (!credorExistsFromDB) {
            console.log(
              "Credor sem cadastro no banco de dados. Atendimento chatbot não iniciado para -",
              fromPhoneNumber
            );
            return;
          }

          const statusAtendimento = await requests.getStatusAtendimento(
            fromPhoneNumber
          );
          const bot_idstatus = statusAtendimento[0]?.bot_idstatus;

          if (!bot_idstatus) {
            console.log(
              "Status de atendimento não encontrado para o usuário -",
              fromPhoneNumber
            );
          } else if (bot_idstatus === 2) {
            console.log("Usuário em atendimento humano -", bot_idstatus);

            if (!redirectSentMap.get(fromPhoneNumber)) {
              await client.sendMessage(
                from,
                "Estamos redirecionando seu atendimento para um atendente humano, por favor aguarde..."
              );
              redirectSentMap.set(fromPhoneNumber, true);
            }
            return;
          } else if ([1, 3].includes(bot_idstatus) || bot_idstatus === "") {
            console.log("Usuário em atendimento automático -", bot_idstatus);
          }

          const ticketStatus = await requests.getTicketStatusByPhoneNumber(
            fromPhoneNumber
          );

          if (ticketStatus && ticketStatus.length > 0) {
            ticketId = ticketStatus[0].id;
            await requests.getAbrirAtendimentoBot(ticketId);
            console.log(
              `Iniciando atendimento Bot para ${fromPhoneNumber} no Ticket - ${ticketId}`
            );
          } else {
            await requests.getInserirNumeroCliente(fromPhoneNumber);

            const insertNovoTicket = await requests.getInserirNovoTicket(
              fromPhoneNumber
            );
            if (insertNovoTicket && insertNovoTicket.insertId) {
              ticketId = insertNovoTicket.insertId;
              await requests.getAbrirAtendimentoBot(ticketId);
              console.log(
                `Iniciando atendimento Bot para ${fromPhoneNumber} no Ticket - ${ticketId} (NOVO)`
              );
            } else {
              console.log("Erro ao criar novo número de Ticket no banco.");
              return;
            }
          }

          const demim = 0;

          stateMachine._setTicketId(ticketId);
          stateMachine._setFromNumber(from);
          stateMachine._setToNumber(to);

          await stateMachine._getRegisterMessagesDB(
            from,
            to,
            message.body,
            ticketId,
            demim
          );
          await stateMachine.handleMessage(fromPhoneNumber, response);
        } catch (error) {
          console.error("Erro ao processar a mensagem:", error);
        }
      } catch (error) {
        console.error("Erro ao lidar com a mensagem:", error);
      }
    });

    client.on("change_state", (data) => {
      console.log(
        `Mudando status da Sessão ${sessionName} -`,
        JSON.stringify(data, undefined, 2)
      );
    });

    client.initialize();
    sessions[sessionName] = client;
  } catch (error) {
    console.error(`Erro ao criar a sessão ${sessionName}:`, error);
  }

  return client;
};

const saveClientData = (client) => {
  const filePath = path.join(__dirname, "clientData.json");
  let clientData = {};

  // Tente ler o arquivo existente
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      clientData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao ler o arquivo de dados do cliente:", error);
  }

  const serverTimezone = "America/Sao_Paulo"; // Substitua pelo fuso horário do seu servidor
  const serverDateTime = new Date().toLocaleString("en-US", {
    timeZone: serverTimezone,
  });

  // Verifique se client.info e client.info.wid estão definidos
  const userId = client.info && client.info.wid ? client.info.wid.user : null;

  // Atualize os dados com a nova conexão
  clientData[client.sessionName] = {
    lastLoggedOut: client.lastLoggedOut,
    connectionState: client.connectionState,
    sessionName: client.sessionName,
    wid: {
      user: userId, // Acessando user dentro de info, agora com verificação
    },
    connectionDateTime: serverDateTime,
  };

  // Escreva os dados atualizados de volta ao arquivo
  try {
    fs.writeFileSync(filePath, JSON.stringify(clientData, null, 2));
    console.log(`Dados da sessão ${client.sessionName} salvos em ${filePath}`);
  } catch (error) {
    console.error("Erro ao salvar os dados do cliente:", error);
  }
};

const getConnectionStatus = (instanceName) => {
  const client = sessions[instanceName];

  if (!client) {
    return "disconnected"; // ou "none" para indicar que a sessão não existe
  }
  return client.connectionState || "unknown";
};

const saveQRCodeImage = async (qr, sessionName) => {
  const qrCodeImage = qrImage.image(qr, { type: "png" });
  const qrCodeFileName = `qrcode_${sessionName}.png`;
  const qrCodeFilePath = path.join(qrCodeDataPath, qrCodeFileName);

  const qrCodeWriteStream = fs.createWriteStream(qrCodeFilePath);
  qrCodeImage.pipe(qrCodeWriteStream);

  qrCodeWriteStream.on("finish", () => {
    console.log(`QR Code image saved: ${qrCodeFilePath}`);
  });
};

const deleteAllQRCodeImages = () => {
  const qrCodesDir = path.join(__dirname, "../src/qrcodes");

  if (fs.existsSync(qrCodesDir)) {
    const files = fs.readdirSync(qrCodesDir);
    files.forEach((file) => {
      const filePath = path.join(qrCodesDir, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filePath}:`, err);
        } else {
          console.log(`File ${filePath} deleted successfully`);
        }
      });
    });
  } else {
    console.log("QR codes directory does not exist.");
  }
};

const disconnectSession = async (sessionName) => {
  const client = sessions[sessionName];

  if (client) {
    try {
      try {
        // Tente realizar o logout
        await client.logout();
        console.log(`Logout da sessão ${sessionName} realizado com sucesso.`);
      } catch (logoutError) {
        // Se o logout falhar, registrar o erro, mas continuar o processo
        console.error(
          `Erro ao realizar logout da sessão ${sessionName}. Prosseguindo com a limpeza...`,
          logoutError
        );
      }

      const sessionPath = path.join(
        __dirname,
        "../.wwebjs_auth",
        `session-${sessionName}`
      );

      // Função para excluir a pasta da sessão
      const deleteFolderRecursive = (folderPath) => {
        if (fs.existsSync(folderPath)) {
          fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              // Recursivamente exclui pastas
              deleteFolderRecursive(curPath);
            } else {
              // Exclui arquivos
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(folderPath);
          console.log(
            `Diretório de autenticação da sessão ${sessionName} excluído com sucesso!`
          );
        }
      };

      // Excluir a pasta da sessão
      deleteFolderRecursive(sessionPath);

      // Destruir o cliente e remover a sessão da memória
      await client.destroy();
      delete sessions[sessionName];
      delete stateMachines[sessionName];
      console.log(`Sessão ${sessionName} removida da memória com sucesso.`);

      // Remover a sessão do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));
      delete clientData[sessionName];
      fs.writeFileSync(clientDataPath, JSON.stringify(clientData, null, 2));
      console.log(`Sessão ${sessionName} removida do clientData.json.`);
    } catch (error) {
      console.error(`Erro ao desconectar a sessão ${sessionName}:`, error);
      throw error;
    }
  } else {
    console.log(`Sessão ${sessionName} não encontrada.`);
  }
};

const disconnectAllSessions = async () => {
  const sessionsPath = path.join(__dirname, "../.wwebjs_auth");

  try {
    const files = fs.readdirSync(sessionsPath);
    const sessionDirs = files.filter(
      (file) =>
        fs.lstatSync(path.join(sessionsPath, file)).isDirectory() &&
        file.startsWith("session-")
    );

    for (const dir of sessionDirs) {
      const sessionName = dir.substring("session-".length); // Remove o prefixo "session-"
      await disconnectSession(sessionName);
    }
  } catch (error) {
    console.error("Erro ao ler o diretório de sessões:", error);
    throw error;
  }
};

const restoreSession = (sessionName) => {
  const sessionFolder = `session-${sessionName}`;
  const sessionPath = path.join(__dirname, "../.wwebjs_auth", sessionFolder);

  if (fs.existsSync(sessionPath)) {
    try {
      console.log(`Restaurando sessão de ${sessionName}...`);
      createSession(sessionName);
    } catch (error) {
      console.error(
        `Erro ao tentar reconectar a instancia ${sessionName}: ${error.message}`
      );
    }
  } else {
    console.error(`O diretório ${sessionPath} não existe.`);
  }
};

const restoreAllSessions = async () => {
  const authDir = path.join(__dirname, "../.wwebjs_auth");
  console.log("Diretório de autenticação:", authDir);

  if (fs.existsSync(authDir)) {
    const sessionFolders = fs.readdirSync(authDir);
    console.log("Pastas de sessão encontradas:", sessionFolders);

    sessionFolders.forEach(async (sessionFolder) => {
      const sessionName = sessionFolder.replace("session-", "");

      try {
        console.log(`Restaurando sessão de ${sessionName}...`);
        await createSession(sessionName);
      } catch (error) {
        console.error(
          `Erro ao tentar reconectar a instancia ${sessionName}: ${error.message}`
        );
      }
    });
  } else {
    console.error(`O diretório ${authDir} não existe.`);
  }
};

const validateAndFormatNumber = (number) => {
  if (typeof number !== "string") {
    throw new Error("Number must be a string");
  }

  // Remove qualquer caractere não numérico
  const cleanedNumber = number.replace(/\D/g, "");

  // Valida o comprimento do número (deve ser 12 ou 13 dígitos)
  if (cleanedNumber.length < 12 || cleanedNumber.length > 13) {
    throw new Error("Invalid phone number length: must be 12 or 13 digits");
  }

  let formattedNumber;

  // Se o número tiver 13 dígitos, remove o nono dígito extra
  if (cleanedNumber.length === 13) {
    // Mantém o código do país e do estado, e remove o nono dígito extra
    formattedNumber = cleanedNumber.slice(0, 4) + cleanedNumber.slice(5);
  } else {
    // Se o número tem 12 dígitos, usa como está
    formattedNumber = cleanedNumber;
  }

  // Garante que o número começa com o código do país
  if (!formattedNumber.startsWith("55")) {
    throw new Error("Invalid country code: must start with 55");
  }

  // Retorna o número formatado
  return formattedNumber;
};

const getAllFiles = (dirPath, arrayOfFiles = []) => {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
};

const deleteSession = (sessionName) => {
  const clientDataFilePath = path.join(__dirname, "clientData.json");
  let clientData = {};

  // Tente ler o arquivo existente
  try {
    if (fs.existsSync(clientDataFilePath)) {
      const fileContent = fs.readFileSync(clientDataFilePath, "utf-8");
      clientData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao ler o arquivo de dados do cliente:", error);
    return { error: "Erro ao ler o arquivo de dados do cliente." };
  }

  // Verifica se a sessão existe e está desconectada
  if (
    clientData[sessionName] &&
    clientData[sessionName].connectionState === "disconnected"
  ) {
    const sessionDirPath = path.join(sessionDataPath, `session-${sessionName}`);

    // Remove o diretório da sessão
    try {
      if (fs.existsSync(sessionDirPath)) {
        fs.rmSync(sessionDirPath, { recursive: true, force: true });
        console.log(`Diretório da sessão ${sessionName} removido com sucesso.`);
      }
    } catch (error) {
      console.error(
        `Erro ao remover o diretório da sessão ${sessionName}:`,
        error
      );
      return {
        error: `Erro ao remover o diretório da sessão ${sessionName}.`,
      };
    }

    // Remove os dados da sessão do arquivo JSON
    delete clientData[sessionName];

    // Atualiza o arquivo JSON
    try {
      fs.writeFileSync(clientDataFilePath, JSON.stringify(clientData, null, 2));
      console.log("Dados das sessões atualizados no arquivo JSON.");
    } catch (error) {
      console.error("Erro ao salvar os dados do cliente:", error);
      return { error: "Erro ao salvar os dados do cliente." };
    }

    return { success: `Sessão ${sessionName} removida com sucesso.` };
  } else {
    return { error: "Sessão não encontrada ou não está desconectada." };
  }
};

// const deleteUnusedSessions = async () => {
//   const clientDataFilePath = path.join(__dirname, "clientData.json");
//   let clientData = {};

//   // Tente ler o arquivo existente
//   try {
//     if (fs.existsSync(clientDataFilePath)) {
//       const fileContent = fs.readFileSync(clientDataFilePath, "utf-8");
//       clientData = JSON.parse(fileContent);
//     }
//   } catch (error) {
//     console.error("Erro ao ler o arquivo de dados do cliente:", error);
//     return;
//   }

//   // Filtra as sessões desconectadas e remove os diretórios e dados correspondentes
//   for (const sessionName of Object.keys(clientData)) {
//     if (clientData[sessionName].connectionState !== "open") {
//       const sessionDirPath = path.join(
//         sessionDataPath,
//         `session-${sessionName}`
//       );

//       // Remove o diretório da sessão
//       if (fs.existsSync(sessionDirPath)) {
//         try {
//           fs.rmSync(sessionDirPath, { recursive: true, force: true });
//           console.log(
//             `Diretório da sessão ${sessionName} removido com sucesso.`
//           );
//         } catch (error) {
//           console.error(
//             `Erro ao remover o diretório da sessão ${sessionName}:`,
//             error
//           );
//         }
//       }

//       // Remove os dados da sessão do arquivo JSON
//       delete clientData[sessionName];
//     }
//   }

//   // Atualiza o arquivo JSON
//   try {
//     fs.writeFileSync(clientDataFilePath, JSON.stringify(clientData, null, 2));
//     console.log("Dados das sessões atualizados no arquivo JSON.");
//   } catch (error) {
//     console.error("Erro ao salvar os dados do cliente:", error);
//   }
// };

const deleteUnusedSessions = async () => {
  const clientDataFilePath = path.join(__dirname, "clientData.json");
  let clientData = {};

  // Função para excluir a pasta da sessão
  const deleteFolderRecursive = (folderPath, sessionName) => {
    if (fs.existsSync(folderPath)) {
      fs.readdirSync(folderPath).forEach((file) => {
        const curPath = path.join(folderPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // Recursivamente exclui pastas
          deleteFolderRecursive(curPath, sessionName);
        } else {
          // Exclui arquivos
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(folderPath);
      console.log(
        `Diretório de autenticação da sessão ${sessionName} excluído com sucesso!`
      );
    }
  };

  // Tente ler o arquivo existente
  try {
    if (fs.existsSync(clientDataFilePath)) {
      console.log("Arquivo clientData.json encontrado e lido corretamente.");
      const fileContent = fs.readFileSync(clientDataFilePath, "utf-8");
      clientData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Erro ao ler o arquivo clientData.json:", error);
    return;
  }

  // Filtra as sessões desconectadas e remove os diretórios e dados correspondentes
  for (const sessionName of Object.keys(clientData)) {
    if (clientData[sessionName].connectionState !== "open") {
      const sessionPath = path.join(
        __dirname,
        "../.wwebjs_auth",
        `session-${sessionName}`
      );

      // Remove o diretório da sessão usando deleteFolderRecursive
      deleteFolderRecursive(sessionPath, sessionName);

      // Remove os dados da sessão do arquivo JSON
      delete clientData[sessionName];
    }
  }

  // Verifica por diretórios de sessões que não estão em clientData e os remove
  try {
    const sessionDirs = fs.readdirSync(path.join(__dirname, "../.wwebjs_auth"));
    for (const dir of sessionDirs) {
      if (dir.startsWith("session-")) {
        const sessionName = dir.replace("session-", "");
        const sessionDirPath = path.join(__dirname, "../.wwebjs_auth", dir);

        // Verifica se a sessão não existe no clientData e remove o diretório se necessário
        if (
          !clientData[sessionName] &&
          fs.lstatSync(sessionDirPath).isDirectory()
        ) {
          deleteFolderRecursive(sessionDirPath, sessionName);
          delete sessions[sessionName];
        }
      }
    }
  } catch (error) {
    console.error("Erro ao listar diretórios de sessões:", error);
  }

  // Atualiza o arquivo JSON
  try {
    fs.writeFileSync(clientDataFilePath, JSON.stringify(clientData, null, 2));
    console.log("Dados das sessões atualizados no arquivo JSON.");
  } catch (error) {
    console.error("Erro ao salvar os dados do cliente:", error);
  }
};

app.post("/instance/create", (req, res) => {
  const { instanceName } = req.body;

  const qrCodeFilePath = path.join(
    qrCodeDataPath,
    `qrcode_${instanceName}.png`
  );

  if (!instanceName) {
    return res.status(400).json({ error: "instanceName is required" });
  }

  if (sessions[instanceName]) {
    console.log(`Session ${instanceName} already exists`);
    return res
      .status(400)
      .json({ error: `Session ${instanceName} already exists` });
  }

  if (fs.existsSync(qrCodeFilePath)) {
    console.log(`QR Code image for session ${instanceName} already exists`);
    // return res.status(400).json({
    //   error: `QR Code image for session ${instanceName} already exists`,
    // });
  }

  console.log("Creating a new session...");

  try {
    createSession(instanceName);
    res.status(201).json({
      instance: {
        instanceName,
        status: "created",
      },
    });
  } catch (error) {
    res.status(500).json({
      error: `Error creating session: ${error.message}`,
    });
  }
});

app.post("/restore/:sessionName", (req, res) => {
  const { sessionName } = req.params;

  if (!sessionName) {
    return res.status(400).send("sessionName is required");
  }

  try {
    restoreSession(sessionName);
    res.json({
      success: true,
      message: `Session ${sessionName} restored successfully`,
    });
  } catch (error) {
    res.status(403).json({
      error: `Error restoring session: ${error.message}`,
    });
  }
});

app.post("/restoreAll", (req, res) => {
  try {
    restoreAllSessions();

    res.json({
      success: true,
      message: "Todas as sessões foram restauradas com sucesso",
    });
  } catch (error) {
    res.status(403).json({
      error: `Erro ao restaurar todas as sessões: ${error.message}`,
    });
  }
});

app.post("/chat/whatsappNumbers/:sessionName", async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { numbers } = req.body;

    const client = sessions[sessionName];

    if (!client) {
      return res
        .status(500)
        .json({ success: false, message: "Client is not initialized" });
    }

    if (!Array.isArray(numbers) || numbers.length !== 1) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid input format. "numbers" should be an array containing exactly one number.',
      });
    }

    const number = numbers[0];

    // Valida e formata o número
    const formattedNumber = validateAndFormatNumber(number);

    try {
      const isRegistered = await client.isRegisteredUser(formattedNumber);

      if (isRegistered === true) {
        console.log(
          `Número ${number} existe no WhatsApp, isRegistered -`,
          isRegistered
        );
        return res.status(200).json([
          {
            exists: isRegistered,
          },
        ]);
      } else {
        console.log(
          `Número ${number} NÃO existe no WhatsApp, isRegistered -`,
          isRegistered
        );
        return res.status(404).json([
          {
            exists: isRegistered,
          },
        ]);
      }
    } catch (error) {
      console.error(`Erro ao verificar o número ${number}:`, error.message);
      return res.status(404).json([
        {
          exists: false,
        },
      ]);
    }
  } catch (error) {
    console.error("Erro na rota whatsappNumbers", error.message);
    return res.status(404).json([
      {
        exists: false,
      },
    ]);
  }
});

app.delete("/instance/logout/:sessionName", async (req, res) => {
  const { sessionName } = req.params;

  if (!sessionName) {
    return res.status(400).send("sessionName is required");
  }

  try {
    await disconnectSession(sessionName);

    res.json({
      success: true,
      message: `Session ${sessionName} disconnected successfully`,
    });
  } catch (error) {
    res.status(500).json({
      error: `Error disconnecting session: ${error.message}`,
    });
  }
});

app.delete("/instance/logoutAll", async (req, res) => {
  try {
    await disconnectAllSessions();
    res.json({
      success: true,
      message: "All sessions disconnected successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: `Error disconnecting all sessions: ${error.message}`,
    });
  }
});

app.delete("/instance/deleteSession/:sessionName", (req, res) => {
  const sessionName = req.params.sessionName;

  try {
    const result = deleteSession(sessionName);
    if (result.success) {
      res.status(200).json(result.success);
    } else {
      res.status(404).json(result.error);
    }
  } catch (error) {
    console.error("Erro ao tentar excluir a sessão:", error);
    res.status(500).json("Erro ao tentar excluir a sessão.");
  }
});

app.delete("/instance/clearUnusedSessions", (req, res) => {
  try {
    deleteUnusedSessions();
    res.status(200).json("Sessões não utilizadas foram removidas com sucesso.");
  } catch (error) {
    console.error("Erro ao limpar sessões não utilizadas:", error);
    res.status(500).json("Erro ao limpar sessões não utilizadas.");
  }
});

app.delete("/qrcodes", (req, res) => {
  try {
    deleteAllQRCodeImages();
    res.json({
      success: true,
      message: "All QR code images deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: `Error deleting QR code images: ${error.message}`,
    });
  }
});

app.get("/instance/listFolders", (req, res) => {
  const authDir = path.join(__dirname, "../.wwebjs_auth"); // Ajuste no caminho para a pasta raiz
  console.log("Diretório de autenticação:", authDir); // Adicionado para depuração

  if (fs.existsSync(authDir)) {
    const sessionFolders = fs.readdirSync(authDir);
    const instanceNames = sessionFolders.map((sessionFolder) =>
      sessionFolder.replace("session-", "")
    );
    console.log({ instances: instanceNames });
    res.json({ instances: instanceNames });
  } else {
    res.json({ instances: [] });
  }
});

app.get("/instance/fetchInstances", (req, res) => {
  const clientDataPath = path.join(__dirname, "clientData.json"); // Caminho para o arquivo clientData.json

  // Verificar se o arquivo clientData.json existe
  if (fs.existsSync(clientDataPath)) {
    try {
      // Leitura do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));

      // Extrair informações para cada instância com connectionState: 'open'
      const instances = Object.keys(clientData)
        .filter((key) => clientData[key].connectionState === "open")
        .map((key) => ({
          instance: {
            instanceName: clientData[key].sessionName,
            owner: clientData[key].wid.user,
            // state: clientData[key].connectionState,
          },
        }));

      console.log({ instances });
      res.json(instances); // Enviar resposta JSON com as instâncias encontradas
    } catch (error) {
      console.error(
        "Erro ao ler ou analisar o arquivo clientData.json:",
        error
      );
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  } else {
    console.log("Arquivo clientData.json não encontrado em:", clientDataPath);
    res.status(404).json([]); // Se o arquivo não existe, retornar um array vazio
  }
});

app.get("/instance/fetchAllInstances", (req, res) => {
  const clientDataPath = path.join(__dirname, "clientData.json"); // Caminho para o arquivo clientData.json

  // Verificar se o arquivo clientData.json existe
  if (fs.existsSync(clientDataPath)) {
    try {
      // Leitura do arquivo clientData.json
      const clientData = JSON.parse(fs.readFileSync(clientDataPath, "utf8"));

      // Extrair informações para cada instância com connectionState: 'open'
      const instances = Object.keys(clientData).map((key) => ({
        instance: {
          sessionName: clientData[key].sessionName,
          lastLoggedOut: clientData[key].lastLoggedOut,
          connectionState: clientData[key].connectionState,
          wid: {
            user: clientData[key].wid.user,
          },
          connectionDateTime: clientData[key].connectionDateTime,
        },
      }));

      console.log({ instances });
      res.json(instances); // Enviar resposta JSON com as instâncias encontradas
    } catch (error) {
      console.error(
        "Erro ao ler ou analisar o arquivo clientData.json:",
        error
      );
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  } else {
    console.log("Arquivo clientData.json não encontrado em:", clientDataPath);
    res.status(404).json([]); // Se o arquivo não existe, retornar um array vazio
  }
});

app.get("/instance/connectionState/:instanceName", (req, res) => {
  const { instanceName } = req.params;
  const state = getConnectionStatus(instanceName);
  res.json({ instanceName, state });
});

app.get("/instance/connect/:sessionName", (req, res) => {
  const { sessionName } = req.params;

  const qrCodeFilePath = path.join(
    __dirname,
    "qrcodes",
    `qrcode_${sessionName}.png`
  );

  if (fs.existsSync(qrCodeFilePath)) {
    const image = fs.readFileSync(qrCodeFilePath, { encoding: "base64" });
    const base64Image = `data:image/png;base64,${image}`;
    res.json({
      instance: sessionName,
      base64: base64Image,
    });
  } else {
    res.status(404).json({ error: "QR code not found" });
  }
});

app.get("/instance/connect/image/:sessionName", (req, res) => {
  const { sessionName } = req.params;

  const qrCodeFilePath = path.join(
    __dirname,
    "qrcodes",
    `qrcode_${sessionName}.png`
  );

  if (fs.existsSync(qrCodeFilePath)) {
    // Define o tipo de conteúdo da resposta como imagem/png
    res.type("png");

    // Lê o arquivo de imagem e transmite como resposta
    fs.createReadStream(qrCodeFilePath).pipe(res);
  } else {
    res.status(404).json({ error: "QR code not found" });
  }
});

app.post("/sendMessage", async (req, res) => {
  const { instanceName, number, mediaMessage } = req.body;
  const client = sessions[instanceName];

  if (!instanceName || !number || !mediaMessage) {
    return res
      .status(400)
      .send("instanceName, number, and mediaMessage are required");
  }

  // if (!client || client.connectionState !== "open") {
  //   return res
  //     .status(400)
  //     .send(`Session ${instanceName} is disconnected or does not exist`);
  // }

  try {
    const { mediatype, fileName, caption, media } = mediaMessage;

    let processedNumber = number;
    const brazilCountryCode = "55";

    if (
      processedNumber.startsWith(brazilCountryCode) &&
      processedNumber.length === 13
    ) {
      processedNumber = processedNumber.slice(0, -1);
    }

    // Obter o arquivo de mídia
    const response = await axios.get(media, {
      responseType: "arraybuffer",
    });
    const mimeType = response.headers["content-type"];
    const mediaData = Buffer.from(response.data, "binary").toString("base64");

    const messageMedia = new MessageMedia(mimeType, mediaData, fileName);

    await client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log("Mensagem enviada com sucesso!");
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    res.status(404).send({
      status: 404,
      error: "Not Found",
      message: [`The "${instanceName}" instance does not exist`],
    });
  }
});

app.post("/message/sendText/:instanceName", async (req, res) => {
  const { number, options, textMessage } = req.body;
  const { instanceName } = req.params;
  const client = sessions[instanceName];

  if (!instanceName || !number || !textMessage || !textMessage.text) {
    return res
      .status(400)
      .send("instanceName, number, and textMessage.text are required");
  }

  // if (!client || client.connectionState !== "open") {
  //   return res
  //     .status(400)
  //     .send(`Session ${instanceName} is disconnected or does not exist`);
  // }

  try {
    let processedNumber = number;
    const brazilCountryCode = "55";

    if (processedNumber.startsWith(brazilCountryCode)) {
      const localNumber = processedNumber.slice(4);

      if (localNumber.length === 9 && localNumber.startsWith("9")) {
        processedNumber =
          brazilCountryCode +
          processedNumber.slice(2, 4) +
          localNumber.slice(1);
      }
    }

    await client.sendMessage(`${processedNumber}@c.us`, textMessage.text);

    console.log(
      `Mensagem de texto enviada com sucesso ao numero ${number} pela instancia ${instanceName} no horário ${new Date()}!`
    );
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    res.status(404).send({
      status: 404,
      error: "Not Found",
      message: [`The "${instanceName}" instance does not exist`],
    });
  }
});

app.post("/message/sendMedia/:instanceName", async (req, res) => {
  const { number, mediaMessage } = req.body;
  const { instanceName } = req.params;
  const client = sessions[instanceName];

  if (!instanceName || !number || !mediaMessage || !mediaMessage.media) {
    return res
      .status(400)
      .send("instanceName, number, and mediaMessage.media are required");
  }

  try {
    let processedNumber = number;
    const brazilCountryCode = "55";

    if (processedNumber.startsWith(brazilCountryCode)) {
      const localNumber = processedNumber.slice(4);

      if (localNumber.length === 9 && localNumber.startsWith("9")) {
        processedNumber =
          brazilCountryCode +
          processedNumber.slice(2, 4) +
          localNumber.slice(1);
      }
    }

    const { media, fileName, caption } = mediaMessage;
    console.log(`Tentando acessar URL de mídia: ${media}`);

    const response = await axios.get(media, {
      responseType: "arraybuffer",
      timeout: 5000, // 5 segundos
    });

    if (response.status !== 200) {
      throw new Error(
        `Media URL is not accessible. Status code: ${response.status}`
      );
    }

    // const response = await axios.get(media, {
    //   responseType: "arraybuffer",
    //   timeout: 5000, // 5 segundos
    // });

    const mimeType = response.headers["content-type"];
    const mediaData = Buffer.from(response.data, "binary").toString("base64");
    const messageMedia = new MessageMedia(mimeType, mediaData, fileName);

    await client.sendMessage(`${processedNumber}@c.us`, messageMedia, {
      caption: caption,
    });

    console.log(
      `Mensagem de media enviada com sucesso ao numero ${number} pela instancia ${instanceName} no horário ${new Date()}!`
    );
    res.status(200).json({ status: "PENDING" });
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.error(`Conexão recusada ao tentar acessar ${media}`);
      return res.status(500).json({
        status: "error",
        message: `Não foi possível conectar ao servidor remoto: ${error.message}`,
      });
    } else {
      console.error(`Erro desconhecido: ${error.message}`);
      return res.status(500).json({
        status: "error",
        message: `Erro ao processar a requisição: ${error.message}`,
      });
    }
  }
});

app.get("/listAllFiles", (req, res) => {
  try {
    // Verificar se o diretório existe
    if (!fs.existsSync(mediaDataPath)) {
      console.error(`Diretório ${mediaDataPath} não existe`);
      return res
        .status(400)
        .json({ error: `Diretório ${mediaDataPath} não existe` });
    }

    console.log(`Lendo arquivos do diretório: ${mediaDataPath}`);
    const files = getAllFiles(mediaDataPath);

    // Obter informações de modificação dos arquivos
    const fileStats = files.map((file) => {
      const stat = fs.statSync(file);
      return { file, mtime: stat.mtime };
    });

    // Ordenar arquivos por data de modificação (mais recentes primeiro)
    fileStats.sort((a, b) => b.mtime - a.mtime);

    const fileUrls = fileStats.map(({ file }) => ({
      fileName: path.basename(file),
      url: `${urlWebhook}/media${file
        .replace(mediaDataPath, "")
        .replace(/\\/g, "/")}`,
    }));

    res.json(fileUrls);
  } catch (error) {
    console.error("Erro ao ler o diretório", error);
    res.status(500).json({ error: "Erro ao ler o diretório" });
  }
});

app.use("/media", express.static(mediaDataPath));

// const privateKey = fs.readFileSync(
//   "/etc/letsencrypt/live/whatsapp.cobrance.online/privkey.pem",
//   "utf8"
// );
// const certificate = fs.readFileSync(
//   "/etc/letsencrypt/live/whatsapp.cobrance.online/fullchain.pem",
//   "utf8"
// );
// const ca = fs.readFileSync(
//   "/etc/letsencrypt/live/whatsapp.cobrance.online/chain.pem",
//   "utf8"
// );
// const credentials = { key: privateKey, cert: certificate, ca };
// const httpsServer = https.createServer(credentials, app);

// httpsServer.listen(port, async () => {
//   console.log(`Servidor HTTPS iniciado na porta ${port}`);

//   initializeConnectionStatus();
//   await restoreAllSessions();
// });

app.listen(port, async () => {
  console.log(`Servidor HTTP iniciado na porta ${port}`);

  initializeConnectionStatus();
  await restoreAllSessions();
});

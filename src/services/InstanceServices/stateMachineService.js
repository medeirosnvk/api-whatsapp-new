/* eslint-disable no-undef */
/* eslint-disable indent */
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
class StateMachine {
  static stateMachines = {};

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

    stateMachineManager.stateMachines[sessionName] = this;
    console.log(`StateMachine criada e registrada para a sessão: ${sessionName}`);
  }

  // Método para acessar uma máquina de estado por sessão
  static getStateMachine(sessionName) {
    return StateMachine.stateMachines[sessionName] || null;
  }

  // Método para deletar uma máquina de estado por sessão
  static deleteStateMachine(sessionName) {
    if (StateMachine.stateMachines[sessionName]) {
      delete StateMachine.stateMachines[sessionName];
      console.log(`StateMachine removida para a sessão: ${sessionName}`);
    } else {
      console.log(`Nenhuma StateMachine encontrada para a sessão: ${sessionName}`);
    }
  }

  // Método para listar todas as máquinas de estado
  static listStateMachines() {
    return Object.keys(StateMachine.stateMachines);
  }

  // Métodos adicionais para a lógica interna da máquina de estado
  getState() {
    return `Estado atual da sessão ${this.sessionName}`;
  }

  _setConnectedUsers(phoneNumber, ticketId) {
    if (this.connectedUsers && this.connectedUsers[phoneNumber]) {
      this.connectedUsers = {
        ...this.connectedUsers,
        [phoneNumber]: {
          ticketId: ticketId,
        },
      };
    } else {
      this.connectedUsers[phoneNumber] = {
        ticketId,
      };
    }
  }

  static async setTicketId(ticketId) {
    this.ticketId = ticketId;
  }

  static async setFromNumber(from) {
    this.fromNumber = from;
  }

  static async setToNumber(to) {
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
    console.log("Estado atualizado:", this.userStates[phoneNumber].currentState);
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
      await this._getRegisterMessagesDB(this.toNumber, this.fromNumber, body, this.ticketId, demim);

      await this.client.sendMessage(origin, body);
    } else {
      await this.client.sendMessage(origin, body);
    }
  }

  static async getCredorFromDB(phoneNumber) {
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
          const liberaApiResponse = await executeQuery(liberaApiQuery, customDbConfig);

          // Se o liberaApiResponse retornar 'S' retorne o primeiro credor
          if (liberaApiResponse && liberaApiResponse.length && liberaApiResponse[0].liberaApi === "S") {
            console.log(`Libera API encontrada para o número ${phoneNumber}.`);
            this._setCredor(phoneNumber, dbResponse[0]);
            return dbResponse[0];
          }
        }

        // Se nenhum valor de liberaApi for encontrado, retorna null
        console.log(`Nenhuma liberação de API encontrada para o número ${phoneNumber}.`);
        return null;
      } else {
        console.log(`Nenhum credor encontrado para o número ${phoneNumber}.`);
        return null;
      }
    } catch (error) {
      console.error(`Erro ao buscar credor para o número ${phoneNumber}:`, error);
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

  static async getRegisterMessagesDB(from, to, message, ticketId, demim) {
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

  async _handleInitialState(origin, phoneNumber) {
    const credor = await this.getCredorFromDB(phoneNumber);

    if (!credor || credor.length === 0) {
      console.log("Credor sem cadastro no banco de dados. Atendimento chatbot não iniciado para -", phoneNumber);
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
            const messageErro = "Você não possui dívidas ou ofertas disponíveis.";
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
          await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
        }
        break;

      case "2":
        try {
          await this._handleAcordoState(origin, phoneNumber); // Passando o phoneNumber como argumento
        } catch (error) {
          console.error("Case 2 retornou um erro - ", error.message);
          await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
        }
        break;

      case "3":
        try {
          await this._handleBoletoState(origin, phoneNumber, response); // Passando o phoneNumber e response como argumentos
        } catch (error) {
          console.error("Case 3 retornou um erro - ", error.message);
          await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
        }
        break;

      case "4":
        try {
          await this._handlePixState(origin, phoneNumber, response); // Passando o phoneNumber e response como argumentos
        } catch (error) {
          console.error("Case 4 retornou um erro - ", error.message);
          await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
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

            await this._postMessage(origin, "Resposta inválida. Por favor, tente novamente.");
            return;
          }
        }

        if (selectedCreditor) {
          this._setDataCredorSelecionado(phoneNumber, selectedCreditor);

          const idDevedor = selectedCreditor.iddevedor;
          const dataBase = utils.getCurrentDate();

          const [credorDividas, credorOfertas] = await Promise.all([requests.getCredorDividas(idDevedor, dataBase), requests.getCredorOfertas(idDevedor)]);

          this._setDataCredorDividas(phoneNumber, credorDividas);

          const formattedResponseDividas = utils.formatCredorDividas(credorDividas);
          const formattedResponseOfertas = utils.formatCredorOfertas(credorOfertas);

          const terceiraMensagem = `As seguintes dívidas foram encontradas para a empresa selecionada:\n\n${formattedResponseDividas}\n\n*Escolha uma das opções abaixo para prosseguirmos no seu acordo:*\n\n${formattedResponseOfertas}`;

          await this._postMessage(origin, terceiraMensagem);
          this._setCurrentState(phoneNumber, "OFERTA");
        }
      } else {
        await this._postMessage(origin, "Não foi possível encontrar informações para o documento fornecido.");
      }
    } catch (error) {
      console.error("Erro ao lidar com o estado do credor:", error);
      await this._postMessage(origin, "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.");
    }
  }

  async _handleOfertaState(origin, phoneNumber, response) {
    try {
      if (response && response.body.trim().match(/^\d+$/)) {
        const selectedOptionParcelamento = parseInt(response.body.trim());

        const credorByPhone = await requests.getCredorByPhoneNumber(phoneNumber);

        const { cpfcnpj } = credorByPhone[0];
        const credorInfo = await requests.getCredorInfo(cpfcnpj);
        const { comissao_comercial, idcomercial, idgerente_comercial, iddevedor } = credorInfo[0];

        const credorOfertas = await requests.getCredorOfertas(iddevedor);

        if (selectedOptionParcelamento >= 1 && selectedOptionParcelamento <= credorOfertas.length) {
          await this._postMessage(origin, "Aguarde, estamos gerando o seu acordo...");

          const ofertaSelecionada = credorOfertas[selectedOptionParcelamento - 1];
          this._setDataOferta(phoneNumber, ofertaSelecionada);

          const { periodicidade, valor_parcela, plano, idcredor, total_geral } = ofertaSelecionada;

          const ultimaDataParcela = utils.getUltimaDataParcela(periodicidade, valor_parcela, plano);

          const { parcelasArray, ultimaData } = ultimaDataParcela;
          const ultimaDataFormat = ultimaData.toISOString().slice(0, 10);

          const currentDate = new Date();
          const currentTime = utils.getCurrentTime();

          const newDataBase = currentDate.getDate() + parseInt(plano) * periodicidade;
          const formattedDate = newDataBase.toString().substring(0, 10);

          const { data: promessas } = await requests.getCredorDividas(iddevedor, formattedDate);

          const obj = {
            promessas,
            ultimaDataVencimento: ultimaData.toISOString().slice(0, 10),
            vencimentosParcelas: parcelasArray,
          };

          this._setDataPromessas(phoneNumber, obj);

          const responseDividasCredores = await requests.getCredorDividas(iddevedor, ultimaDataFormat);

          const responseDividasCredoresTotais = await requests.getCredorDividasTotais(iddevedor, ultimaDataFormat);

          const { juros_percentual, honorarios_percentual, multa_percentual, tarifa_boleto } = responseDividasCredoresTotais;

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
            const { contrato } = dividas;

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
          const { percentual_comissao_cobrador, idoperacao, idempresa } = responseDividasCredores[0];

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

          if (responseRecibo && Object.prototype.hasOwnProperty.call(responseRecibo, "error")) {
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

          if (updateValoresBoleto && Object.prototype.hasOwnProperty.call(updateValoresBoleto, "error")) {
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

          const responseBoletoContent = await requests.getImagemBoleto(parsedData4);

          const parsedData5 = utils.parseDadosImagemQrCode({ idboleto });

          const responseQrcodeContent = await requests.getImagemQrCode(parsedData5);

          await utils.saveQRCodeImageToLocal(responseQrcodeContent.url, idboleto);

          const media = MessageMedia.fromFilePath(`src/qrcodes/${idboleto}.png`);

          // Verifique se a imagem foi salva corretamente
          const imageExists = await utils.checkIfFileExists(`src/qrcodes/${idboleto}.png`);
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

            console.log(`ACORDO FECHADO! IdDevedor - ${iddevedor} IdAcordo - ${idacordo} para o nº ${phoneNumber} em ${formattedDateTime}`);

            await requests.getFecharAtendimentoHumano(this.ticketId);
          } catch (error) {
            console.error("Erro ao enviar as mensagens: mensagemAcordo, media e mensagemRecibo", error);
          }
        } else {
          // Resposta inválida, informar o usuário
          await this._postMessage(origin, "Resposta inválida. Por favor, escolha uma opção válida.");
          this._setCurrentState(phoneNumber, "OFERTA"); // Mantém o estado OFERTA
        }
      } else {
        // Resposta não numérica, informar o usuário
        await this._postMessage(origin, "Resposta inválida. Por favor, escolha uma opção válida.");
        this._setCurrentState(phoneNumber, "OFERTA"); // Mantém o estado OFERTA
      }
    } catch (error) {
      console.error("Erro ao lidar com o estado de oferta:", error);
    }
  }

  async _handleAcordoState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = await this.getCredorFromDB(phoneNumber);

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
      await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
    }
  }

  async _handleBoletoState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = await this.getCredorFromDB(phoneNumber);

      const acordosFirmados = await requests.getAcordosFirmados(document);

      if (!acordosFirmados || acordosFirmados.length === 0) {
        const message = "Você não possui acordos nem Linhas Digitáveis a listar.";
        await this._postMessage(origin, message);
        await this._handleInitialState(origin, phoneNumber, response);
      } else {
        const responseBoletoPixArray = [];

        for (const acordo of acordosFirmados) {
          const iddevedor = acordo.iddevedor;

          try {
            const responseBoletoPix = await requests.getDataBoletoPix(iddevedor);
            responseBoletoPixArray.push(responseBoletoPix);
            console.log(`responseBoletoPix executado para ${iddevedor} com resposta ${responseBoletoPix}`);
          } catch (error) {
            console.error("Erro ao obter dados do boleto para iddevedor", iddevedor, ":", error.message);
            await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
            return;
          }
        }

        if (acordosFirmados.length > 0 && responseBoletoPixArray.length === 0) {
          await this._postMessage(origin, "Boleto vencido ou não disponível.");
          await this._handleInitialState(origin, phoneNumber, response);
        } else if (responseBoletoPixArray.length === 1 && responseBoletoPixArray[0].length === 0) {
          await this._postMessage(origin, "Boleto vencido ou não disponível.");
          await this._handleInitialState(origin, phoneNumber, response);
        } else {
          const formatBoletoPixArray = utils.formatCodigoBoleto(responseBoletoPixArray);
          const message = `${formatBoletoPixArray}`;
          await this._postMessage(origin, message);
          await this._handleInitialState(origin, phoneNumber, response);
        }
      }
    } catch (error) {
      console.error("Case 3 retornou um erro - ", error.message);
      await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
    }
  }

  async _handlePixState(origin, phoneNumber, response) {
    try {
      const { cpfcnpj: document } = await this.getCredorFromDB(phoneNumber);

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
            const responseBoletoPix = await requests.getDataBoletoPix(iddevedor);
            responseBoletoPixArray.push(responseBoletoPix);
            console.log(`responseBoletoPix executado para ${iddevedor} com resposta ${responseBoletoPix}`);
          } catch (error) {
            console.error("Erro ao obter dados do boleto para iddevedor", iddevedor, ":", error.message);
            await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
            return;
          }
        }

        // Verificar se acordosFirmados tem dados e responseBoletoPixArray está vazio ou indefinido
        if (acordosFirmados.length > 0 && responseBoletoPixArray.length === 0) {
          await this._postMessage(origin, "Código PIX vencido ou não disponível.");
          await this._handleInitialState(origin, phoneNumber, response);
        } else if (responseBoletoPixArray.length === 1 && responseBoletoPixArray[0].length === 0) {
          await this._postMessage(origin, "Código PIX vencido ou não disponível.");
          await this._handleInitialState(origin, phoneNumber, response);
        } else {
          const formatBoletoPixArray = utils.formatCodigoPix(responseBoletoPixArray);

          const message = `${formatBoletoPixArray}`;
          await this._postMessage(origin, message);
          await this._handleInitialState(origin, phoneNumber, response);
        }
      }
    } catch (error) {
      console.error("Case 4 retornou um erro - ", error.message);
      await this._handleErrorState(origin, phoneNumber, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
    }
  }

  static async handleMessage(phoneNumber, response) {
    try {
      let { currentState } = this._getState(phoneNumber);
      const origin = response.from;

      if (!currentState) {
        currentState = "INICIO";
      }

      console.log(`[Sessão: ${this.sessionName} - Número: ${phoneNumber} - Estado: ${currentState}]`);

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

module.exports = StateMachine;

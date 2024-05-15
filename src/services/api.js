const axios = require("axios");

const baseURL = "http://191.252.214.9:3030";
// const baseURL = 'http://localhost:3000';

const axiosApiInstance = axios.create({ baseURL });

module.exports = {
  axiosApiInstance,
};

const axios = require("axios");

const baseURL = "https://api.cobrance.online:3030";

const axiosApiInstance = axios.create({ baseURL });

module.exports = {
  axiosApiInstance,
};

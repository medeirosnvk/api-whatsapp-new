module.exports = {
  apps: [
    {
      name: "api-whatsapp-new",
      script: "npm", // <--- Directly point to the app entry file
      args: "start",
      watch: false,
      autorestart: true, // Reiniciar automaticamente em caso de falhas
      restart_delay: 5000, // Tempo de espera antes de reiniciar em caso de erro (em milissegundos)
      max_restarts: 10, // Número máximo de tentativas de reinício
    },
  ],
};

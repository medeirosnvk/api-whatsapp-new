module.exports = {
  apps: [
    {
      name: "api-whatsapp-new",
      script: "npm",
      args: "start",
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      interpreter: "none", // 👈 evita que o PM2 tente usar Node duas vezes
      instances: 1, // 👈 garante que apenas uma instância seja executada
      exec_mode: "fork", // 👈 modo de execução fork em vez de cluster
      kill_timeout: 3000, // tempo em ms para matar o processo se não responder
    },
  ],
};

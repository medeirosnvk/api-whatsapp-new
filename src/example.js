const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const wwebVersion = "2.2412.54";

const client = new Client({
    authStrategy: new LocalAuth(),
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
        takeoverOnConflict: true,
    },
    webVersionCache: {
        type: "remote",
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`,
    },
});

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("Client is ready!");
});

client.on("message", (msg) => {
    console.log(`Mensagem ${msg.body} recebida de ${msg.from}`);

    if (msg.body == "!ping") {
        msg.reply("pong");
    }
});

client.initialize();

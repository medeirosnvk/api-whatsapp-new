/* eslint-disable quotes */
const { Client, LocalAuth, Buttons } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("Client is ready!");
});

client.on("message", async (message) => {
    console.log(`Mensagem ${message.body} recebido de ${message.from}`);

    if (message.body === "ping") {
        await client.sendMessage(message.from, "pong");
    } else if (message.body === "button") {
        let button = new Buttons(
            "Button body",
            [{ body: "bt1" }, { body: "bt2" }, { body: "bt3" }],
            "title",
            "footer"
        );

        console.log(button);

        await client.sendMessage(message.from, button);
    }
});

client.initialize();

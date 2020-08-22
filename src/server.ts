import * as net from "net";
import Game, { Difficulty } from "./game";

let currentGame: Game = null;

const server = net.createServer((c) => {
    if (game === null) {
        game = new Game()
    }

    c.on('end', () => {
        connected = 2;
        console.log("Ended", id);
    });

    c.on("data", (data: Buffer) => {
        connected = 1;
    });

    let messageCount = 0;
    function sendMessage() {
        console.log(id, "Sending Message", connected);
        if (connected === 1) {
            const out = `:json:${JSON.stringify({count: connectionMsgCount++, msg: "hello, world"})}`;
            c.write(`${out.length}${out}`);
        }
        if (connected === 2) {
            return
        }

        if (messageCount++ < 10) {
            setTimeout(sendMessage, 1000);
        }
    }

    setTimeout(sendMessage, 1000);
});

server.on('error', (err) => {
    console.log(err);
});
server.listen(42069, () => {
    console.log('server bound');
});


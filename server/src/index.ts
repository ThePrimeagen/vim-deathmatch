import * as net from "net";
import GameRunner from "./game-runner";

let game = new GameRunner();

const server = net.createServer((c) => {
    game.addPlayer(c);
});

server.on('error', (err) => {
    console.log(err);
});
server.listen(42069, () => {
    console.log('server bound');
});


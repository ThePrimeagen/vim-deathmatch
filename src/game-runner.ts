import { EventEmitter } from "events";
import * as net from "net";
import { createGame, Difficulty, Game } from "./game";

export default class GameRunner extends EventEmitter {
    private game?: Game;
    constructor() {
        super();
    }

    addPlayer(player: net.Socket) {
        this.emit("info", "GameRunner", this.game);
        if (!this.game || !this.game.needsPlayers() || this.game.isFinished()) {
            this.game = createGame(Difficulty.easy, "Start Text", "End Text");
        }

        this.game.addPlayer(player);
    }
}


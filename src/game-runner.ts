import { EventEmitter } from "events";
import * as net from "net";
import { createGame, Difficulty, Game } from "./game";

import { Logger } from "./logger";

export default class GameRunner extends EventEmitter {
    private game?: Game;
    private logger: Logger;

    constructor() {
        super();
        this.logger = new Logger(() => [
            this.game && this.game.getInfo(),
        ], {
            className: `GameRunner`
        });
    }

    addPlayer(player: net.Socket) {
        this.logger.info("addPlayer");
        if (!this.game || !this.game.needsPlayers() ||
            this.game.isFinished() || this.game.hasDisconnection()) {

            this.game = createGame(Difficulty.easy, "Start Text", "End Text");
        }

        this.game.addPlayer(player);
    }
}


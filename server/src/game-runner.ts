import { EventEmitter } from "events";
import * as net from "net";
import { createGame, Difficulty, Game } from "./game";
import generatePuzzle from "./puzzles";

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

            const puzzle = generatePuzzle();
            this.game = createGame(Difficulty.easy, puzzle.start, puzzle.end);
        }
        this.game.addPlayer(player);
    }
}


import * as net from "net";

import HandleMsg, { createMessage } from "./handle-messages";
import { PlayerStats, Stats } from "./score";
import { Logger, getNewId } from "./logger";

export const READY_COMMAND_TIMEOUT = 5000;
const NO_READY_COMMAND_MSG = `Did not receive a ready command within ${READY_COMMAND_TIMEOUT / 1000} seconds of connection.`;
export const START_COMMAND_ACCEPT_TIMEOUT = 5000;
const START_COMMAND_ACCEPT_MSG = `Was unable to send a start game command.`;
const GAME_FAILED_TO_START = "The game has failed to start due to the other player";

// ReturnType<typeof setTimeout>

export enum Difficulty {
    easy = "easy",
    medium = "medium",
    hard = "hard",
};

export type WinningMessage = {
    failed: boolean;
    winner: boolean;
    expired: boolean;
    scoreDifference: number;
    keysPressedDifference: number;
    timeDifference: number;
};

class Player {
    public id: number;
    public conn: net.Socket;
    public ready: boolean = false;
    public finished: boolean = false;
    public started: boolean = false;
    public timedout: boolean = false;
    public failed: boolean = false;
    public disconnected: boolean = false;
    public timerId: ReturnType<typeof setTimeout>;
    public stats: Stats;
    public failureMessage: string | null;

    constructor(conn: net.Socket, public parser: HandleMsg) {
        this.stats = new Stats();
        this.conn = conn;
        this.failureMessage = null;
    }

    // I like this,
    // but I am not going to do it yet...
    send(type: string, message: string | object): Promise<void> {
        return new Promise((res, rej) => {
            const msg = createMessage(type, message);
            if (this.conn.destroyed) {
                return;
            }

            this.conn.write(msg, (e) => {
                if (e) {
                    rej(e);
                    return;
                }
                res();
            });
        });
    }

    toObj() {
        return {
            id: this.id,
            ready: this.ready,
            finished: this.finished,
            started: this.started,
            failed: this.failed,
            timedout: this.timedout,
            disconnected: this.disconnected,
            stats: this.stats,
        };
    }
}

type Callback = (...args: any) => void;

let _gameId = 0;

export class Game {
    private p1: Player;
    private p2: Player;
    private timerId: ReturnType<typeof setTimeout>;
    private callbacks: {[key: string]: Callback[]};
    private gameId: number;
    private logger: Logger;

    constructor(private difficulty: Difficulty,
                private startText: string,
                private goalText: string) {

        this.callbacks = {};
        this.gameId = getNewId();
        this.logger = new Logger(() => [this.p1, this.p2], {
            className: "Game",
            id: this.gameId,
        });
        this.p1 = this.p2 = null;
        this.logger.info("GameConstructor", difficulty, startText, goalText);
    }

    toObj() {
        return {
            needsPlayers: this.needsPlayers(),
            isFinished: this.isFinished(),
            hasFailure: this.hasFailure(),
        };
    }

    getMaximumGameTime() {
        return 30000;
    }

    private emit(type: string, fromFunction: string, ...args: any): void {
        const cbs = this.callbacks[type];
        if (cbs) {
            cbs.forEach(cb => {
                cb(this.gameId, "Game", fromFunction, ...args);
            });
        }
    }

    public needsPlayers(): boolean {
        this.logger.info("needsPlayers");
        return !this.p1 || !this.p2;
    }

    public addPlayer(p: net.Socket) {
        const player = new Player(p, new HandleMsg(this.gameId));

        let whichPlayer = 1;
        if (!this.p1) {
            this.p1 = player;
        } else {
            whichPlayer = 2;
            this.p2 = player;
        }

        player.id = whichPlayer;

        this.logger.info("addPlayer", player);
        this.setPlayerFailureTime(
            player, READY_COMMAND_TIMEOUT, NO_READY_COMMAND_MSG);

        p.on("data", (d) => {
            console.log("DATA", d);
            const {
                completed,
                type,
                message
            } = player.parser.parse(d.toString());

            if (completed) {
                this.logger.info("data#completed", player.id, type, message);
                this.processMessage(player, type, message);
            }
        });

        p.on("end", () => {
            this.onConnectionEnded(player);
        });
    }

    public on(type: string, cb: Callback): void {
        if (!this.callbacks[type]) {
            this.callbacks[type] = [];
        }

        this.callbacks[type].push(cb);
    }

    public getPlayer(sock: net.Socket) {
        return this.p1.conn === sock ? this.p1 : this.p2;
    }

    public otherPlayer(player: Player | net.Socket): Player {
        return (this.p1 === player || this.p1.conn === player) ?
            this.p2 : this.p1;
    }

    private async onConnectionEnded(player: Player) {
        this.logger.info("onConnectionEnded", player.id);
        if (player.disconnected === true) {
            return;
        }

        player.disconnected = true;
        if (!player.finished) {
            await this.endGame(true);
        }
    }

    private timeoutPlayer(player: Player) {
        if (!player.finished) {
            player.timedout = true;
        }
    }

    private setTimeout() {
        const remaining = this.getMaximumGameTime();

        this.logger.info("setTimeout", remaining);
        if (!this.p1.started || !this.p2.started) {
            return;
        }

        this.timerId = setTimeout(() => {
            this.logger.info("setTimeout#expired");
            this.timeoutPlayer(this.p1);
            this.timeoutPlayer(this.p2);
            this.endGame(true);
        }, remaining);
    }

    private cancelPlayerFailure(player: Player) {
        this.logger.info("cancelPlayerFailure", player.id);
        if (player.timerId) {
            clearTimeout(player.timerId);
            player.timerId = null;
        }
    }

    private setPlayerFailureTime(player: Player, time: number, failureMessage: string) {
        this.logger.info("setPlayerFailureTime", player.id, time);

        player.timerId = setTimeout(() => {
            if (!player.started) {
                player.failed = true;
                player.failureMessage = failureMessage;
                player.timerId = null;
                this.endGame(true);
            }
        }, time);
    }

    private async processMessage(player: Player, type: string, msg: string) {
        this.logger.info("processMessage", player.id, type, msg);
        if (type === "ready") {
            player.ready = true;
            this.cancelPlayerFailure(player);
            this.startGame();
            return;
        }

        else if (type === "finished") {
            const stats = new PlayerStats(msg);
            this.logger.info("processMessage#finished", stats);

            if (stats.failed) {
                this.logger.info("error", "processMessage#finished", player.id, type, msg);
                player.failed;
                await this.endGame();
            }
            else {
                player.stats.calculateScore(stats);
                player.finished = true;
                const gameEnded = await this.endGame();
                this.logger.info("processMessage#finished -- calculateScore", gameEnded, stats);

                if (!gameEnded) {
                    await player.send("waiting", "Waiting for other player to finish...");
                }
            }
        }
    }

    private startGame() {
        this.logger.info("startGame");

        if (!this.p1.ready || !this.p2 || !this.p2.ready) {
            return;
        }

        const msg = createMessage("start-game", {
            startText: this.startText,
            goalText: this.goalText,
        });

        this.logger.info("startGame", msg);

        this.setPlayerFailureTime(
            this.p1, START_COMMAND_ACCEPT_TIMEOUT, START_COMMAND_ACCEPT_MSG);

        this.p1.conn.write(msg, (e?: Error) => {
            this.logger.info("startGame#p1#startGameMessageCallback", e);
            if (e || this.p1.failed) {
                // TODO: Handle this?
                return;
            }

            this.cancelPlayerFailure(this.p1);
            this.p1.started = true;
            this.p1.stats.start();
            this.setTimeout();
        });

        this.setPlayerFailureTime(
            this.p2, START_COMMAND_ACCEPT_TIMEOUT, START_COMMAND_ACCEPT_MSG);

        this.p2.conn.write(msg, (e?: Error) => {
            this.logger.info("startGame#p2#startGameMessageCallback", e);
            if (e || this.p2.failed) {
                // TODO: Handle this?
                return;
            }

            this.cancelPlayerFailure(this.p2);
            this.p2.started = true;
            this.p2.stats.start();
            this.setTimeout();
        });
    }

    private async sendFatalMessage(player: Player): Promise<void> {
        await player.send("finished", {
            failed: player.failed,
            winner: false,
            msg: player.failed ? player.failureMessage : GAME_FAILED_TO_START
        });
    }

    private async fatalEnding(): Promise<void> {
        this.logger.info("fatalEnding");

        const msgs: Promise<void>[] = [];

        if (!this.p1) {
            throw new Error("THIS SHOULD LITERALLY NEVER HAPPEN");
        }
        msgs.push(this.sendFatalMessage(this.p1));
        this.p1 = null;

        if (this.p2) {
            msgs.push(this.sendFatalMessage(this.p2));
            this.p2 = null;
        }

        if (this.timerId) {
            clearTimeout(this.timerId);
        }

        await Promise.all(msgs);
    }

    private async sendAndDisconnect(player: Player, message: string | object) {
        const msg = typeof message === "object" ?
            JSON.stringify(message) : message;

        player.conn.write(msg, (e) => {
            this.logger.info("endGame", message, e);
            player.disconnected = true;
            player.conn.end();
        });
    }

    public hasFailure(): boolean {
        const p1 = this.p1;
        const p2 = this.p2;

        this.logger.info("hasFailure");

        if (p1 && p1.failed) {
            return true;
        }

        if (p2 && p2.failed) {
            return true;
        }

        return false;
    }

    public isFinished(): boolean {
        const p1 = this.p1;
        const p2 = this.p2;

        this.logger.info("isFinished");
        return p1 && (p1.finished || p1.timedout) &&
            p2 && (p2.finished || p2.timedout)
    }

    private async endGame(force: boolean = false): Promise<boolean> {

        this.logger.info("endGame",
                  force, this.isFinished());

        if (this.hasFailure()) {
            this.fatalEnding();
            return true;
        }

        if (!this.isFinished()) {
            return false;
        }

        if (this.timerId) {
            this.logger.info("endGame#this.timerId is being cleared");
            clearTimeout(this.timerId);
        }

        if (this.p1.timedout && this.p2.timedout) {
            this.logger.info("endGame#timedout");
            const msg = createMessage("finished", {
                winner: false,
                expired: true,
                scoreDifference: 0,
                keysPressedDifference: 0,
                timeDifference: 0
            });

            this.sendAndDisconnect(this.p1, msg);
            this.sendAndDisconnect(this.p2, msg);
            return;
        }

        const winner =
            this.p1.stats.score > this.p2.stats.score ? this.p1 : this.p2;
        const loser = this.otherPlayer(winner);

        this.logger.info("endGame Winner and Loser", winner.id, loser.id);

        const score: WinningMessage = {
            failed: false,
            winner: true,
            expired: false,
            scoreDifference: winner.stats.score - loser.stats.score,
            keysPressedDifference: winner.stats.keysPressed.length -
                loser.stats.keysPressed.length,
            timeDifference: winner.stats.timeTaken - loser.stats.timeTaken
        };

        const winnerMessage = createMessage("finished", score);
        const losersMessage = createMessage("finished", {
            ...score,
            expired: loser.timedout,
            winner: false
        });

        this.logger.info("endGame endingScore", score);
        this.sendAndDisconnect(winner, winnerMessage);
        this.sendAndDisconnect(loser, losersMessage);

        return true;
    }
}

export function createGame(diff: Difficulty, startText: string, endText: string): Game {
    return new Game(diff, startText, endText);
}


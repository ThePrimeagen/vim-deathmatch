import * as net from "net";

import HandleMsg, { createMessage } from "./handle-messages";
import { PlayerStats, Stats } from "./score";
import { Logger, getNewId } from "./logger";

export const READY_COMMAND_TIMEOUT = 5000;
const NO_READY_COMMAND_MSG = `Did not receive a ready command within ${READY_COMMAND_TIMEOUT / 1000} seconds of connection.`;
export const START_COMMAND_ACCEPT_TIMEOUT = 5000;
const START_COMMAND_ACCEPT_MSG = `Was unable to send a start game command.`;
const GAME_FAILED_TO_START = "The game has failed to start due to the other player";

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

    private logger: Logger;

    constructor(conn: net.Socket, public parser: HandleMsg, logger?: Logger) {
        this.stats = new Stats();
        this.conn = conn;
        this.failureMessage = null;
        this.logger = logger && logger.child(() => [], "Player") ||
            new Logger(() => [], { className: "Player" });
    }

    // I like this,
    // but I am not going to do it yet...
    send(typeOrMsg: string, message?: string | object): Promise<void> {
        const messageId = getNewId();
        const msg = message ? createMessage(typeOrMsg, message) : typeOrMsg;

        this.logger.info("send", messageId, msg);

        return new Promise((res, rej) => {
            if (this.conn.destroyed) {
                return;
            }

            this.conn.write(msg, (e) => {
                this.logger.info("send#response", e);
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

export class Game {
    public gameId: number;
    public logger: Logger;

    private p1: Player;
    private p2: Player;
    private timerId: ReturnType<typeof setTimeout>;
    private callbacks: {[key: string]: Callback[]};

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

    getInfo(): string {
        return `Game ${this.gameId}`;
    }

    public needsPlayers(): boolean {
        this.logger.info("needsPlayers");
        return !this.p1 || !this.p2;
    }

    public addPlayer(p: net.Socket) {
        const player = new Player(p, new HandleMsg(this.logger), this.logger);

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

    private async sendWaitingForFinish(player: Player) {
        await player.send("waiting", {
            msg: [
                "",
                "",
                " Waiting for other player to finish...",
                "",
                "",
            ]
        });
    }

    private async sendWaitingForPlayer(player: Player) {
        await player.send("waiting", {
            msg: [
                "",
                "",
                " Waiting for other player to connect...",
                "",
                "",
            ]
        });
    }

    private async processMessage(player: Player, type: string, msg: string) {
        this.logger.info("processMessage", player.id, type, msg);

        if (type === "ready") {
            player.ready = true;
            this.cancelPlayerFailure(player);
            this.startGame();
            await this.sendWaitingForPlayer(player);
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
                    await this.sendWaitingForFinish(player);
                }
            }
        }
    }

    private async startGame() {
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

        const p1P = this.p1.send(msg).then(() => {
            this.logger.info("startGame#p1#startGameMessageCallback");

            this.cancelPlayerFailure(this.p1);
            this.p1.started = true;
            this.p1.stats.start();
            this.setTimeout();
        }).
        catch(e => {
            this.logger.info("startGame#p1#startGameMessageCallback ERROR", e);
            if (e || this.p1.failed) {
                // TODO: Handle this?
                return;
            }
        });

        this.setPlayerFailureTime(
            this.p2, START_COMMAND_ACCEPT_TIMEOUT, START_COMMAND_ACCEPT_MSG);

        const p2P = this.p2.send(msg).then(() => {
            this.logger.info("startGame#p2#startGameMessageCallback");
            this.cancelPlayerFailure(this.p2);
            this.p2.started = true;
            this.p2.stats.start();
            this.setTimeout();
        }).catch(e => {
            this.logger.info("startGame#p2#startGameMessageCallback ERROR", e);
            if (e || this.p2.failed) {
                // TODO: Handle this?
                return;
            }
        });

        await Promise.all([p1P, p2P]);
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

    private async sendAndDisconnect(player: Player, message: string) {

        player.send(message).then(() => {
            this.logger.info("endGame");
            player.disconnected = true;
            player.conn.end();
        }).catch(e => {
            this.logger.info("endGame#error", e);
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

    public hasDisconnection() {
        const p1 = this.p1;
        const p2 = this.p2;

        return p1 && p1.disconnected ||
            p2 && p2.disconnected;
    }

    public isFinished(): boolean {
        const p1 = this.p1;
        const p2 = this.p2;

        this.logger.info("isFinished");
        return p1 && (p1.finished || p1.timedout || p1.disconnected) &&
            p2 && (p2.finished || p2.timedout || p2.disconnected);
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


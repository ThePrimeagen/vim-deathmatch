import * as net from "net";

import HandleMsg, { createMessage } from "./handle-messages";
import { PlayerStats, Stats } from "./score";

const READY_COMMAND_TIMEOUT = 30000;
const NO_READY_COMMAND_MSG = `Did not receive a ready command within ${READY_COMMAND_TIMEOUT / 1000} seconds of connection.`;
const START_COMMAND_ACCEPT_TIMEOUT = 30000;
const START_COMMAND_ACCEPT_MSG = `Was unable to send a start game command.`;

// ReturnType<typeof setTimeout>

export enum Difficulty {
    easy = "easy",
    medium = "medium",
    hard = "hard",
};

export type WinningMessage = {
    winner: boolean;
    expired: boolean;
    scoreDifference: number;
    keysPressedDifference: number;
    timeDifference: number;
};

class Player {
    public id: number;
    public conn: net.Socket;
    public parser: HandleMsg = new HandleMsg();
    public ready: boolean = false;
    public finished: boolean = false;
    public started: boolean = false;
    public timedout: boolean = false;
    public failed: boolean = false;
    public disconnected: boolean = false;
    public timerId: ReturnType<typeof setTimeout>;
    public stats: Stats;
    public failureMessage: string | null;

    constructor(conn: net.Socket) {
        this.stats = new Stats();
        this.conn = conn;
        this.failureMessage = null;
    }

    // I like this,
    // but I am not going to do it yet...
    send(type: string, message: string | object): Promise<void> {
        return new Promise((res, rej) => {
            const msg = createMessage(type, message);
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

export default class Game {
    private p1: Player;
    private p2: Player;
    private timerId: ReturnType<typeof setTimeout>;
    private callbacks: {[key: string]: Callback[]};
    private gameId: number;

    constructor(private difficulty: Difficulty,
                private startText: string,
                private goalText: string) {

        this.callbacks = {};
    }

    getMaximumGameTime() {
        return 30000;
    }

    private emit(type: string, fromFunction: string, ...args: any): void {
        const cbs = this.callbacks[type];
        if (cbs) {
            cbs.forEach(cb => {
                cb("Game", fromFunction, ...args);
            });
        }
    }

    public needsPlayers(): boolean {
        this.emit("info", "needsPlayers", !!this.p1, !!this.p2);
        return !this.p1 || !this.p2;
    }

    public addPlayer(p: net.Socket) {
        const player = new Player(p);

        let whichPlayer = 1;
        if (!this.p1) {
            this.p1 = player;
        } else {
            whichPlayer = 2;
            this.p2 = player;
        }

        player.id = whichPlayer;

        this.emit("info", "addPlayer", player);
        this.setPlayerFailureTime(
            player, READY_COMMAND_TIMEOUT, NO_READY_COMMAND_MSG);

        p.on("data", (d) => {
            const {
                completed,
                type,
                message
            } = player.parser.parse(d.toString());

            if (completed) {
                this.emit("info", "data#completed", player.toObj(), type, message);
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

    private onConnectionEnded(player: Player) {
        this.emit("info", "onConnectionEnded", player.toObj());
        if (player.disconnected === true) {
            return;
        }

        player.disconnected = true;
        if (!player.finished) {
            this.endGame(true);
        }
    }

    private timeoutPlayer(player: Player) {
        if (!player.finished) {
            player.timedout = true;
        }
    }

    private setTimeout() {
        const remaining = this.getMaximumGameTime();

        this.emit("info", "setTimeout", remaining, this.p1.started && this.p2.started);
        if (!this.p1.started || !this.p2.started) {
            return;
        }

        this.timerId = setTimeout(() => {
            this.emit("info", "setTimeout#expired", this.p1, this.p2);
            this.timeoutPlayer(this.p1);
            this.timeoutPlayer(this.p2);
            this.endGame(true);
        }, remaining);
    }

    private cancelPlayerFailure(player: Player) {
        this.emit("info", "cancelPlayerFailure", player);
        if (player.timerId) {
            clearTimeout(player.timerId);
            player.timerId = null;
        }
    }

    private setPlayerFailureTime(player: Player, time: number, failureMessage: string) {
        this.emit("info", "setPlayerFailureTime", player, time);

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
        if (type === "ready") {
            player.ready = true;
            this.cancelPlayerFailure(player);
            this.startGame();
            return;
        }

        else if (type === "finished") {
            const stats = new PlayerStats(msg);
            this.emit("info", "processMessage#finished", stats);

            if (stats.failed) {
                this.emit("info", "processMessage#finished", player.toObj, type, msg);
                this.emit("error", "processMessage#finished", player.toObj, type, msg);
                player.failed;
                this.endGame();
            }
            else {
                player.stats.calculateScore(stats);
                player.finished = true;
                this.emit("info", "processMessage#finished -- calculateScore", stats);

                if (!this.endGame()) {
                    await player.send("waiting", "Waiting for other player to finish...");
                }
            }
        }
    }

    private startGame() {
        this.emit("info", "startGame", this.p1.ready, this.p2.ready);

        if (!this.p1.ready || !this.p2.ready) {
            return;
        }

        const msg = createMessage("start-game", {
            startText: this.startText,
            goalText: this.goalText,
        });

        this.emit("info", "startGame", msg);

        this.setPlayerFailureTime(
            this.p1, START_COMMAND_ACCEPT_TIMEOUT, START_COMMAND_ACCEPT_MSG);

        this.p1.conn.write(msg, (e?: Error) => {
            this.emit("info", "startGame#p1#startGameMessageCallback", e);
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
            this.emit("info", "startGame#p2#startGameMessageCallback", e);
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

    private sendFatalMessage(player: Player) {
    }

    private async fatalEnding(): Promise<void> {
        throw new Error("Not Implemented you bafoon.");
        this.emit("info", "fatalEnding", this.p1.failed, this.p2.failed);

        if (this.p1.failed)
    }

    private async sendAndDisconnect(player: Player, message: string | object) {
        const msg = typeof message === "object" ?
            JSON.stringify(message) : message;

        player.conn.write(msg, (e) => {
            this.emit("info", "endGame", message, e);
            player.disconnected = true;
            player.conn.end();
        });
    }

    private isFinished(): boolean {
        return (this.p1.finished || this.p1.timedout) &&
            (this.p2.finished || this.p2.timedout);
    }

    private async endGame(force: boolean = false): Promise<boolean> {

        this.emit("info", "endGame",
                  force, this.isFinished(), this.p1.toObj(), this.p2.toObj());

        if (!this.isFinished()) {
            if (force) {
                this.fatalEnding();
                return true;
            }
            return false;
        }

        if (this.timerId) {
            this.emit("info", "endGame#this.timerId is being cleared");
            clearTimeout(this.timerId);
        }

        if (this.p1.timedout && this.p2.timedout) {
            this.emit("info", "endGame#timedout");
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

        this.emit("info", "endGame Winner and Loser", winner.id, loser.id);

        const score: WinningMessage = {
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

        this.emit("info", "endGame endingScore", score);
        this.sendAndDisconnect(winner, winnerMessage);
        this.sendAndDisconnect(loser, losersMessage);

        return true;
    }
}




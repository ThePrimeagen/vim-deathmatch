import * as net from "net";

import createText from "./text";
import HandleMsg, { createMessage } from "./handle-messages";

// ReturnType<typeof setTimeout>

export enum Difficulty {
    easy = "easy",
    medium = "medium",
    hard = "hard",
};

export interface IPlayerStats {
    keys: string[];
    undoCount: number;
};

export class PlayerStats {
    keys: string[];
    undoCount: number;
    failed: boolean = false;

    constructor(fromData: string) {
        try {
            const stats = JSON.parse(fromData);

            if (this.validate(stats)) {
                this.keys = stats.keys;
                this.undoCount = stats.undoCount;
            } else {
                this.failed = true;
            }
        } catch (e) {
            this.failed = true;
        }
    }


    private validate(data: IPlayerStats): boolean {
        if (!Array.isArray(data.keys) ||
            data.keys.filter(x => typeof x !== "string").length) {
            return false;
        }

        if (typeof data.undoCount !== "number" || isNaN(data.undoCount)) {
            return false;
        }

        return true;
    }
}

export class Stats {
    public timeTaken: number;
    public score: number;

    private startTime: number;

    start() {
        this.startTime = Date.now();
    }

    calculateScore(statsFromPlayer: PlayerStats) {
        this.timeTaken = Date.now() - this.startTime;
        this.score = statsFromPlayer.keys.length * 50 + this.timeTaken;
    }

    maximumTimeLeft(otherScore: Stats) {
        return otherScore.score - (Date.now() - this.startTime);
    }
}

type Player = {
    conn: net.Socket;
    parser: HandleMsg;
    ready: boolean;
    finished: boolean;
    failed: boolean;
    disconnected: boolean;
    stats: Stats;
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

        this.gameId = _gameId++
        this.callbacks = {};
    }

    public needsPlayers(): boolean {
        return !this.p1 || !this.p2;
    }

    public addPlayer(p: net.Socket) {
        const player: Player = {
            conn: p,
            parser: new HandleMsg(),
            failed: false,
            ready: false,
            finished: false,
            disconnected: false,
            stats: new Stats(),
        };

        if (!this.p1) {
            this.p1 = player;
        } else {
            this.p2 = player;
        }

        p.on("data", (d) => {
            const [
                completed,
                type,
                msg
            ] = player.parser.parse(d.toString());

            if (completed) {
                this.processMessage(player, type, msg);
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
        if (player.disconnected === true) {
            return;
        }

        player.disconnected = true;
        if (!player.finished) {
            this.endGame(true);
        }
    }

    private processMessage(player: Player, type: string, msg: string) {
        if (type === "ready") {
            player.ready = true;
            this.startGame();
            return;
        }

        else if (type === "finished") {
            const stats = new PlayerStats(msg);
            if (stats.failed) {
                player.failed;
                this.endGame();
            }
            else {
                player.stats.calculateScore(stats);
                player.finished = true;

                if (!this.endGame()) {
                }
            }
        }
    }

    private startGame() {
        if (!this.p1.ready || !this.p2.ready) {
            return;
        }

        this.p1.conn.write(createMessage("start-game", {
            startText: this.startText,
            goalText: this.goalText,
        }), (e?: Error) => {
            if (e) {
                // TODO: Handle this?
                return;
            }

            this.p1.stats.start();
        });

        this.p2.conn.write(createMessage("start-game", {
            startText: this.startText,
            goalText: this.goalText,
        }), (e?: Error) => {
            if (e) {
                // TODO: Handle this?
                return;
            }

            this.p2.stats.start();
        });
    }

    private fatalEnding(): boolean {
        return true;
    }

    private endGame(force: boolean = false): boolean {
        if (this.p1.failed || this.p2.failed) {
            return this.fatalEnding();
        }

        if ((!this.p1.finished || !this.p2.finished) && !force) {
            return false;
        }

        if (!this.p1.disconnected) {
            this.p1.conn.end();
        }
        if (!this.p2.disconnected) {
            this.p2.conn.end();
        }

        return true;
    }
}




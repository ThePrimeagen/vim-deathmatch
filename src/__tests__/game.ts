import { incrementTime, reset } from "./mock-date-now";

import {
    READY_COMMAND_TIMEOUT,
    createGame as cG,
    Game,
    Difficulty,
    WinningMessage
} from "../game";

import { keyStrokeScore, timeTakenMSScore } from "../score";
import HandleMsg from "../handle-messages";
import { createMessage } from "../handle-messages";
import MockSocket from "./__helpers__/mock-socket";

import createGame, {
    writeMessage,
    readyPlayers,
    flushMessages,
} from "./__helpers__/game-utils";

import { Logger } from "../logger";

jest.useFakeTimers();

beforeEach(function() {
    jest.clearAllMocks();
});

describe("Game", function() {
    beforeEach(() => reset());

    it("should get two players and send the map down", async function() {
        const [ p1, p2 ] = createGame();

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        await writeMessage(p1, "ready", "");

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        await writeMessage(p2, "ready", "");

        expect(p1.writes.length).toEqual(1);
        expect(p2.writes.length).toEqual(1);

        expect(p1.writes[0]).toEqual(createMessage("start-game", {
            startText: "foo",
            goalText: "bar",
        }));

        expect(p2.writes[0]).toEqual(createMessage("start-game", {
            startText: "foo",
            goalText: "bar",
        }));
    });

    it("When one player finishes, the other player should be forced quit in a specific amount of time.", async function() {

        const [ p1, p2, g] = createGame(true);
        const parser = new HandleMsg(g.logger);

        await readyPlayers(p1, p2);
        flushMessages(p1, p2);

        incrementTime(1000);
        const keysPressed = ["a", "b", "c"];
        await writeMessage(p1, "finished", {
            keys: keysPressed,
            undoCount: 0,
        });

        expect(p1.writes.length).toEqual(1);
        expect(p2.writes.length).toEqual(0);

        const waitingMsg = parser.parse(p1.writes[0]);
        expect(waitingMsg.completed).toEqual(true);
        expect(waitingMsg.type).toEqual("waiting");

        flushMessages(p1, p2);

        jest.advanceTimersByTime(READY_COMMAND_TIMEOUT);

        expect(p1.writes.length).toEqual(1);
        expect(p2.writes.length).toEqual(1);

        const finished1 = parser.parse(p1.writes[0]);
        const finished2 = parser.parse(p2.writes[0]);

        expect(finished1.completed).toEqual(true);
        expect(finished2.completed).toEqual(true);
        expect(finished1.type).toEqual("finished");
        expect(finished2.type).toEqual("finished");

        const m1: WinningMessage = JSON.parse(finished1.message);
        const m2: WinningMessage = JSON.parse(finished2.message);

        expect(m1.winner).toEqual(true);
        expect(m2.winner).toEqual(false);
        expect(m1.expired).toEqual(false);
        expect(m2.expired).toEqual(true);
        expect(m1.scoreDifference).toEqual(timeTakenMSScore(1000) + keyStrokeScore(keysPressed));
    });

    it("Both players will finish, p2 should win due to strokes", async function() {

        const [ p1, p2, g] = createGame(true);
        const parser = new HandleMsg(g.logger);

        await readyPlayers(p1, p2);
        flushMessages(p1, p2);
        incrementTime(1000);

        await writeMessage(p1, "finished", {
            keys: ["a", "b", "c"],
            undoCount: 0,
        });

        flushMessages(p1, p2);

        incrementTime(999);
        await writeMessage(p2, "finished", {
            keys: ["a", "b"],
            undoCount: 0,
        });

        expect(p1.writes.length).toEqual(1);
        expect(p2.writes.length).toEqual(1);

        const finished1 = parser.parse(p1.writes[0]);
        const finished2 = parser.parse(p2.writes[0]);

        expect(finished1.completed).toEqual(true);
        expect(finished2.completed).toEqual(true);
        expect(finished1.type).toEqual("finished");
        expect(finished2.type).toEqual("finished");

        const m1: WinningMessage = JSON.parse(finished1.message);
        const m2: WinningMessage = JSON.parse(finished2.message);

        expect(m1.winner).toEqual(false);
        expect(m2.winner).toEqual(true);
        expect(m1.expired).toEqual(false);
        expect(m2.expired).toEqual(false);

        //expect(m1.scoreDifference).toEqual(1);
    });

    it("Both players do nothing, blue balls situation.", async function() {

        const [ p1, p2, g ] = createGame(true);
        const parser = new HandleMsg(g.logger);

        await readyPlayers(p1, p2);
        flushMessages(p1, p2);

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        jest.advanceTimersByTime(READY_COMMAND_TIMEOUT);

        expect(p1.writes.length).toEqual(1);
        expect(p2.writes.length).toEqual(1);

        const finished1 = parser.parse(p1.writes[0]);
        const finished2 = parser.parse(p2.writes[0]);

        expect(finished1.completed).toEqual(true);
        expect(finished2.completed).toEqual(true);
        expect(finished1.type).toEqual("finished");
        expect(finished2.type).toEqual("finished");

        const m1: WinningMessage = JSON.parse(finished1.message);
        const m2: WinningMessage = JSON.parse(finished2.message);

        expect(m1.winner).toEqual(false);
        expect(m2.winner).toEqual(false);
        expect(m1.expired).toEqual(true);
        expect(m2.expired).toEqual(true);
    });

    it("Player 1 is not able to sent the ready command.", async function() {

        const [ p1, p2, g] = createGame(true);
        const parser = new HandleMsg(g.logger);

        await readyPlayers(p2);

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        jest.advanceTimersByTime(READY_COMMAND_TIMEOUT);

        expect(p1.writes.length).toEqual(1);
        expect(p2.writes.length).toEqual(1);

        const finished1 = parser.parse(p1.writes[0]);
        const finished2 = parser.parse(p2.writes[0]);

        expect(finished1.completed).toEqual(true);
        expect(finished2.completed).toEqual(true);
        expect(finished1.type).toEqual("finished");
        expect(finished2.type).toEqual("finished");

        const m1: WinningMessage = JSON.parse(finished1.message);
        const m2: WinningMessage = JSON.parse(finished2.message);

        expect(m1.winner).toEqual(false);
        expect(m2.winner).toEqual(false);
        expect(m1.failed).toEqual(true);
        expect(m2.failed).toEqual(false);
    });

    it("Player 1 joins, sends no ready command, and no player 2", async function() {
        const game = cG(Difficulty.easy, "foo", "bar");
        const p1 = new MockSocket();

        // @ts-ignore
        game.addPlayer(p1);

        jest.advanceTimersByTime(READY_COMMAND_TIMEOUT);

        expect(game.isFinished()).toEqual(false);
        expect(game.hasFailure()).toEqual(true);
    });

    it("Player 1 joins, then disconnects, game is over.", async function() {
        const game = cG(Difficulty.easy, "foo", "bar");
        const p1 = new MockSocket();

        // @ts-ignore
        game.addPlayer(p1);

        p1.end();

        expect(game.hasDisconnection()).toEqual(true);
    });
});

process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);


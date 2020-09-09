import { incrementTime, reset } from "./mock-date-now";

import Game, { Difficulty, WinningMessage } from "../game";
import { keyStrokeScore, timeTakenMSScore } from "../score";
import HandleMsg from "../handle-messages";
import { createMessage } from "../handle-messages";
import MockSocket from "./mock-socket";

jest.useFakeTimers();

beforeEach(function() {
    jest.clearAllMocks();
});

describe("Game", function() {
    beforeEach(() => reset());

    function createGame(logEmits: boolean = false): [MockSocket, MockSocket, Game] {
        const game = new Game(Difficulty.easy, "foo", "bar");
        if (logEmits) {
            consoleLogEmits(game);
        }

        const p1 = new MockSocket();
        const p2 = new MockSocket();

        //@ts-ignore
        game.addPlayer(p1);

        //@ts-ignore
        game.addPlayer(p2);

        return [p1, p2, game];
    }

    async function writeMessage(p: MockSocket, type: string, message: string | object) {
        await p.callbacks["data"](Buffer.from(createMessage(type, message)));
    }

    function readyPlayers(...args: MockSocket[]) {
        args.forEach(p => writeMessage(p, "ready", ""));
    }

    function flushMessages(p1: MockSocket, p2: MockSocket) {
        p1.writes.length = 0;
        p2.writes.length = 0;
    }

    function consoleLogEmits(game: Game) {
        game.on("info", console.log);
    }

    it("should get two players and send the map down", function() {
        const [ p1, p2 ] = createGame();

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        writeMessage(p1, "ready", "");

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        writeMessage(p2, "ready", "");

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

        const [ p1, p2 ] = createGame(true);
        const parser = new HandleMsg();

        readyPlayers(p1, p2);
        expect(setTimeout).toHaveBeenCalledTimes(1);
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

        jest.advanceTimersByTime(30000);

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

        const [ p1, p2 ] = createGame(true);
        const parser = new HandleMsg();

        readyPlayers(p1, p2);
        expect(setTimeout).toHaveBeenCalledTimes(1);
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

        const [ p1, p2 ] = createGame(true);
        const parser = new HandleMsg();

        readyPlayers(p1, p2);
        expect(setTimeout).toHaveBeenCalledTimes(1);
        flushMessages(p1, p2);

        expect(p1.writes.length).toEqual(0);
        expect(p2.writes.length).toEqual(0);

        jest.advanceTimersByTime(30000);

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

    it.only("Player 1 is not able to sent the ready command.", async function() {

        const [ p1, p2 ] = createGame(true);
        const parser = new HandleMsg();

        readyPlayers(p2);

        jest.advanceTimersByTime(30000);

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
        expect(m1.expired).toEqual(true);
        expect(m2.expired).toEqual(true);
    });
});

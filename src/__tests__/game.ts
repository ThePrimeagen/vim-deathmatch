import Game, { Stats, PlayerStats, Difficulty } from "../game";
import { createMessage } from "../handle-messages";

jest.useFakeTimers();

let dateNowTime = 0;

const boundDate = Date.now.bind(Date);
function getNow() {
    return dateNowTime;
}

beforeEach(() => {
    dateNowTime = 0;

    // @ts-ignore
    Date.now = getNow;
});

afterEach(() => {
    Date.now = boundDate;
});

describe("PlayerStats", function() {
    it("should fail with bad data.", function() {
        const stats = new PlayerStats(JSON.stringify({
            foo: "bar"
        }));

        const stats2 = new PlayerStats(JSON.stringify({
            keys: "bar",
            undoCount: 0,
        }));

        const stats3 = new PlayerStats(JSON.stringify({
            keys: [0],
            undoCount: 0,
        }));

        const stats4 = new PlayerStats(JSON.stringify({
            keys: [0],
        }));

        expect(stats.failed).toEqual(true);
        expect(stats2.failed).toEqual(true);
        expect(stats3.failed).toEqual(true);
        expect(stats4.failed).toEqual(true);
    });

    it("should set the datas", function() {
        const stats = new PlayerStats(JSON.stringify({
            keys: ["i"],
            undoCount: 0
        }));

        expect(stats.failed).toEqual(false);
    });

});

describe("Stats", function() {
    it("Stats should properly calculate maximum time", function() {
        const stats = new Stats();
        const arrayOfKeys = ["s", "h", "u", "t", "u", "p"];
        const timeWaited = 1000;

        stats.start();
        dateNowTime += 1000;
        jest.advanceTimersByTime(timeWaited);

        const playerStats = new PlayerStats(JSON.stringify({
            keys: arrayOfKeys,
            undoCount: 0
        }));

        expect(playerStats.failed).toEqual(false);

        stats.calculateScore(playerStats);

        expect(stats.score).toEqual(timeWaited + arrayOfKeys.length * 50);
    });

    it("should ensure that maximum time is correct", function() {
        const stats = new Stats();
        const stats2 = new Stats();
        const arrayOfKeys = ["s", "h", "u", "t", "u", "p"];
        const timeWaited = 1000;

        stats.start();
        dateNowTime += 500;
        stats2.start();
        dateNowTime += 500;
        jest.advanceTimersByTime(timeWaited);

        const playerStats = new PlayerStats(JSON.stringify({
            keys: arrayOfKeys,
            undoCount: 0
        }));

        expect(playerStats.failed).toEqual(false);

        stats.calculateScore(playerStats);

        expect(stats2.maximumTimeLeft(stats)).toEqual(500 + arrayOfKeys.length * 50);
    });
});

type Callback = (...args: any) => void;
class MockSocket {
    public callbacks: {[key: string]: Callback} = {};
    public writes: any[] = [];
    public ended: boolean = false;

    on(key: string, cb: Callback) {
        this.callbacks[key] = cb;
    }

    write(data: any, cb?: (e?: Error) => void) {
        if (this.ended) {
            throw new Error("NO CALLING ME");
        }
        this.writes.push(data);

        // Probably have to mock this out
        cb();
    }

    end() {
        this.ended = true;
    }
}

describe.only("Game", function() {

    function createGame(): [Game, MockSocket, MockSocket] {
        const game = new Game(Difficulty.easy, "foo", "bar");

        const p1 = new MockSocket();
        const p2 = new MockSocket();

        //@ts-ignore
        game.addPlayer(p1);

        //@ts-ignore
        game.addPlayer(p2);

        return [game, p1, p2];
    }

    function writeMessage(p: MockSocket, type: string, message: string | object) {
        p.callbacks["data"](Buffer.from(createMessage(type, message)));
    }

    function readyPlayers(p1: MockSocket, p2: MockSocket) {
        writeMessage(p1, "ready", "");
        writeMessage(p2, "ready", "");
    }

    function flushMessages(p1: MockSocket, p2: MockSocket) {
        p1.writes.length = 0;
        p2.writes.length = 0;
    }

    it("should get two players and send the map down", function() {
        const [ _, p1, p2 ] = createGame();

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

    it("When one player finishes, the other player should be forced quit in a specific amount of time.", function() {
        const [ game, p1, p2 ] = createGame();
        readyPlayers(p1, p2);
        flushMessages(p1, p2);

        dateNowTime = 1000;

        writeMessage(p1, "finished", {
            keys: ["a", "b", "c"],
            undoCount: 0,
        });
    });
});

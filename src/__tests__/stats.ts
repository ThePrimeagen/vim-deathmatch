import { incrementTime } from "./mock-date-now";
import { Stats, PlayerStats, keyStrokeScore, timeTakenMSScore } from "../score";

jest.useFakeTimers();

describe("Stats", function() {
    it("Stats should properly calculate maximum time", function() {
        const stats = new Stats();
        const arrayOfKeys = ["s", "h", "u", "t", "u", "p"];
        const timeWaited = 1000;

        stats.start();
        incrementTime(timeWaited);
        jest.advanceTimersByTime(timeWaited);

        const playerStats = new PlayerStats(JSON.stringify({
            keys: arrayOfKeys,
            undoCount: 0
        }));

        expect(playerStats.failed).toEqual(false);

        stats.calculateScore(playerStats);

        expect(stats.score).toEqual(
            keyStrokeScore(arrayOfKeys) + timeTakenMSScore(timeWaited));
    });
});



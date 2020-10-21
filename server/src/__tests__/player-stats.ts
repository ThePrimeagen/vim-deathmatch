import { PlayerStats } from "../score";

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



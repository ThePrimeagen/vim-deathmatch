import * as net from "net";

let done = false;
let needsPlayers = true;
let currentGame = null;
jest.mock("../game", function() {
    return {
        createGame() {
            currentGame = {

                needsPlayers() { return needsPlayers; },
                done() { return done; },
                addPlayer: jest.fn(),
                on: jest.fn(),
            };

            return currentGame;
        },
        Difficulty: {easy: "easy"},
    };
});

import GameRunner from "../game-runner";

describe("Game Runner", function() {
    beforeEach(function() {
        done = false;
        needsPlayers = true;
        currentGame = null;
    });

    it("add two players, no problems", function() {
        const runner = new GameRunner();
        runner.addPlayer({} as any as net.Socket);
        expect(currentGame).not.toBeNull();
        runner.addPlayer({} as any as net.Socket);
        expect(currentGame.addPlayer).toBeCalledTimes(2);
    });

    it("done is true, therefore second player should get put into new game.", function() {
        const runner = new GameRunner();
        runner.addPlayer({} as any as net.Socket);
        done = true;
        let g = currentGame;
        expect(currentGame).not.toBeNull();
        runner.addPlayer({} as any as net.Socket);
        expect(currentGame.addPlayer).toBeCalledTimes(1);
        expect(g).not.toEqual(currentGame);
    });

    it("needsPlayers is true, therefore second player should get put into new game.", function() {
        const runner = new GameRunner();
        runner.addPlayer({} as any as net.Socket);
        needsPlayers = false;
        expect(currentGame).not.toBeNull();
        let g = currentGame;
        runner.addPlayer({} as any as net.Socket);
        expect(currentGame.addPlayer).toBeCalledTimes(1);
        expect(g).not.toEqual(currentGame);
    });
});


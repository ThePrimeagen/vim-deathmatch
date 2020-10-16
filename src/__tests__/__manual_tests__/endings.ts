import { setEnabledGlobally } from "../../logger";
import { Game, Difficulty } from "../../game";
import createGame, {
    writeMessage,
    readyPlayers,
    flushMessages,
    solveGame,
} from "../__helpers__/game-utils";

setEnabledGlobally(false);

//1.  Successful game.  everyone does the right thing.
async function successfulGame() {
    console.log("Successful game");
    const [
        p1,
        p2,
    ] = createGame();

    await readyPlayers(p1, p2);
    flushMessages(p1, p2);
    await solveGame(p1);
    await solveGame(p2);

    console.log("P1", p1.writes);
    console.log("P2", p2.writes);
}

function wait(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
}

//2.  Successful game with keyCounts.  everyone does the right thing.
async function successfulGame2() {
    console.log("Successful game 2");
    const [
        p1,
        p2,
    ] = createGame();

    await readyPlayers(p1, p2);
    flushMessages(p1, p2);

    await solveGame(p1, ["f", "b"]);
    await wait(1000);
    await solveGame(p2, ["f", "b", "c"]);

    console.log("P1", p1.writes);
    console.log("P2", p2.writes);
}

[
    //successfulGame,
    successfulGame2,
].forEach(fn => fn());


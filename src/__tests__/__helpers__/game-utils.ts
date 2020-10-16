import MockSocket from "./mock-socket";
import { createMessage } from "../../handle-messages";
import {
    createGame as cG,
    Game,
    Difficulty,
} from "../../game";

export default function createGame(startText: string[] = ["foo"], endText: string[] = ["bar"]): [MockSocket, MockSocket, Game] {
    const game = cG(Difficulty.easy, startText, endText);
    /*
       if (logEmits) {
       consoleLogger(game);
       }
     */

    const p1 = new MockSocket();
    const p2 = new MockSocket();

    //@ts-ignore
    game.addPlayer(p1);

    //@ts-ignore
    game.addPlayer(p2);

    return [p1, p2, game];
}
export async function writeMessage(p: MockSocket, type: string, message: string | object) {
    await p.callbacks["data"](Buffer.from(createMessage(type, message)));
}

export async function readyPlayers(...args: MockSocket[]) {
    await Promise.all(args.map(p => writeMessage(p, "ready", "")));
}

export function flushMessages(p1: MockSocket, p2: MockSocket) {
    p1.writes.length = 0;
    p2.writes.length = 0;
}

export async function solveGame(p: MockSocket, keys: string[] = [], undoCount = 0) {
    await writeMessage(p, "finished", {keys, undoCount});
}


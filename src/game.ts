import createText from "./text";

export enum Difficulty {
    easy = "easy",
    medium = "medium",
    hard = "hard",
}

export default class Game {
    private startText: string;
    private goalText: string;

    constructor(private difficulty: Difficulty) {
        this.startText = "";
        this.goalText = "";
        this.createGame();
    }

    private createGame() {

    }
}




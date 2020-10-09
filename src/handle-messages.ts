import { Logger } from "./logger";

type ParseReturn = [boolean, number, string];

export enum State {
    WaitingForLength = "WaitingForLength",
    WaitingForType = "WaitingForType",
    WaitingForData = "WaitingForData",
}

/*
 * The Protocol
   "length:type:<msg of length: l>"
*/

export function createMessage(type: string, message: string | object): string {
    message = typeof message === "string" ? message : JSON.stringify(message);
    return `${message.length}:${type}:${message}`;
}

export type ParsedMessage = {
    completed: boolean;
    type: string;
    message: string;
}

export default class HandleMsg {
    public tmpMessage = "";
    public msgType = "";
    public msgLength = 0;
    public state: State = State.WaitingForLength;

    private logger: Logger;
    constructor(logger?: Logger) {
        const getState = () => [this.state, this.msgLength, this.msgType];
        this.logger = logger && logger.child(getState, "HandleMsg") ||
           new Logger(getState, {className: "HandleMsg"});
    }

    parse(data: string): ParsedMessage {
        let completed = false;
        let msg = "";
        let currentIdx = 0;

        do {
            if (this.state === State.WaitingForLength) {
                const [
                    found,
                    consumed,
                    parsedString,
                ] = this.readToToken(data, currentIdx, ":");

                currentIdx += consumed;

                if (found) {
                    this.logger.info("parse", +parsedString);
                    this.msgLength = +parsedString;
                    this.state = State.WaitingForType;
                }
            }

            if (this.state === State.WaitingForType) {
                const [
                    found,
                    consumed,
                    parsedString,
                ] = this.readToToken(data, currentIdx, ":");

                currentIdx += consumed;

                if (found) {
                    this.logger.info("parse", parsedString);

                    this.msgType = parsedString;
                    this.state = State.WaitingForData;
                }
            }

            if (this.state === State.WaitingForData) {
                const [
                    found,
                    consumed,
                    parsedString,
                ] = this.readToLength(data, currentIdx, this.msgLength);

                currentIdx += consumed;

                if (found) {
                    this.logger.info("parse", parsedString);
                    this.state = State.WaitingForLength;
                    msg = parsedString;
                    completed = true;
                }
            }

        } while (currentIdx < data.length);

        return {
            completed,
            type: this.msgType,
            message: msg
        };
    }

    private readToToken(msg: string, offset: number, token: string): ParseReturn {
        let completed = false;
        let consumed = 0;
        let parsedString = "";

        const idx = msg.indexOf(token, offset);

        if (idx === -1) {
            this.store(msg.substr(offset));
            consumed = msg.length - offset;
        }
        else {
            parsedString = this.get() + msg.substring(offset, idx);
            completed = true;
            consumed = idx - offset + 1;
        }

        return [
            completed,
            consumed,
            parsedString,
        ];
    }

    private readToLength(msg: string, offset: number, totalLength: number): ParseReturn {
        const current = this.get();
        const remaining = msg.length - offset;
        const toParse = totalLength - current.length;

        let consumed = 0;
        let parsedString = "";
        let completed = false;

        if (remaining >= toParse) {
            parsedString = msg.substr(offset, toParse);
            consumed = toParse;
            completed = true;
        } else {
            this.store(current);
            this.store(msg.substring(offset));
            consumed = msg.length - offset;
        }

        return [
            completed,
            consumed,
            parsedString,
        ];
    }

    private store(msg: string): string {
        this.tmpMessage += msg;
        return this.tmpMessage;
    }

    private get(): string {
        const tmp = this.tmpMessage;
        this.tmpMessage = "";
        return tmp;
    }
};

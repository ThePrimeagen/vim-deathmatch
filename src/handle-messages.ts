type ParseReturn = [boolean, number, string];

export enum State {
    WaitingForLength,
    WaitingForType,
    WaitingForData,
}

export default class HandleMsg {
    public tmpMessage = "";
    public msgType = "";
    public msgLength = 0;
    public state: State = State.WaitingForLength;

    constructor() { }

    parse(data: string): [boolean, string, string] {
        let completed = false;
        let msg = "";

        let currentIdx = 0;
        if (this.state === State.WaitingForLength) {
            const [
                found,
                consumed,
                parsedString,
            ] = this.readToToken(data, currentIdx, ":");

            currentIdx += consumed;

            // TODO: Finish the length, type, and msg parsing.
            if (found) {
            }
        }

        return [
            completed,
            this.msgType,
            msg
        ];
    }

    private readToToken(msg: string, offset: number, token: string): ParseReturn {
        let completed = false;
        let consumed = 0;
        let parsedString = "";

        const idx = msg.indexOf(msg, offset);

        if (idx === -1) {
            this.store(msg.substr(offset));
            consumed = msg.length - offset;
        }
        else {
            parsedString = this.get() + msg.substring(offset, idx);
            completed = true;
            consumed = idx - offset;
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

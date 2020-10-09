export type Callback = (...args: any) => Promise<void>;
export type FilterCallback = (data: any) => boolean;
export default class MockSocket {
    public callbacks: {[key: string]: Callback} = {};
    public writes: any[] = [];
    public ended: boolean = false;

    private filter: FilterCallback;

    addCallbackFilter(cb: FilterCallback) {
        this.filter = cb;
    }

    on(key: string, cb: Callback) {
        this.callbacks[key] = cb;
    }

    write(data: any, cb?: (e?: Error) => void) {
        console.log("I AM WRITING A WRITE", data);
        if (this.ended) {
            throw new Error("NO CALLING ME");
        }

        this.writes.push(data);

        // Probably have to mock this out
        if (cb && (!this.filter || this.filter(data))) {
            console.log("Calling callback");
            cb();
        }
    }

    end() {
        this.ended = true;
        if (this.callbacks.end) {
            this.callbacks.end();
        }
    }
}



import HandleMsg, {State} from "../handle-messages";

describe("HandleMsg", function() {
    it("parse out the length, type, and message correctly", function() {
        const handle = new HandleMsg();
        const msg = JSON.stringify({foo: "bar"});

        expect(handle.state).toEqual(State.WaitingForLength);
        handle.parse(`${msg.length}:onteuh`);
        expect(handle.state).toEqual(State.WaitingForType);
        handle.parse(`:`);
    });
});


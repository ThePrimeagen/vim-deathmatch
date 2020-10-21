import * as net from "net";

import {
    writeMessage,
} from "../__helpers__/game-utils";

import {
    createMessage
} from "../../handle-messages";

const client = new net.Socket();

const PORT = 42069;
const HOST = "45.56.120.121";

client.connect(PORT, HOST, async function() {
    console.log("WE CONNNECTED");
    client.write(Buffer.from(createMessage("ready", "")));
});

client.on("data", function(data) {
    console.log("We data", data.toString());
});

client.on("end", function() {
    console.log("We ended");
});

client.on("error", function(e) {
    console.log("OHH SHAT", e);
});


import { WebSocketServer, WebSocket } from "ws";
import dotenv from 'dotenv';
dotenv.config();
const port = parseInt(process.env.PORT || "3000");
const wss = new WebSocketServer({ port: port });
const sessions = new Map();
function genCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}
setInterval(() => {
    const now = Date.now();
    for (const [code, s] of sessions) {
        if (now - s.createdAt > 5 * 60 * 1000)
            sessions.delete(code);
    }
}, 30_000);
wss.on("connection", (ws) => {
    let joinedCode = null;
    let role = null;
    /// Parse message "create" | "join" | "signal"
    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        if (msg.type === "create") { // create a new session with a code
            const code = genCode();
            sessions.set(code, { a: ws, createdAt: Date.now() });
            joinedCode = code;
            role = "a";
            ws.send(JSON.stringify({ type: "created", code }));
            return;
        }
        if (msg.type === "join") { // join as b
            const session = sessions.get(msg.code);
            if (!session || session.b) {
                ws.send(JSON.stringify({ type: "error", message: "invalid code" }));
                return;
            }
            session.b = ws;
            joinedCode = msg.code;
            role = "b";
            ws.send(JSON.stringify({ type: "joined", code: msg.code }));
            session.a.send(JSON.stringify({ type: "peer-joined" }));
            return;
        }
        if (msg.type === "signal" && joinedCode) {
            const session = sessions.get(joinedCode);
            if (!session)
                return;
            const target = role === "a" ? session.b : session.a;
            target?.send(JSON.stringify({ type: "signal", data: msg.data }));
        }
    });
    ws.on("close", () => {
        if (!joinedCode)
            return;
        const session = sessions.get(joinedCode);
        if (!session)
            return;
        const other = role === "a" ? session.b : session.a;
        other?.send(JSON.stringify({ type: "peer-left" }));
        sessions.delete(joinedCode);
    });
});
console.log(`signaling server on ${port}`);
//# sourceMappingURL=index.js.map
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

dotenv.config();

const port = parseInt(process.env.PORT || "3000");
const wss = new WebSocketServer({ port });

interface Peer {
  ws: WebSocket;
  id: string;
}

interface Session {
  host: WebSocket;
  passwordHash: string;
  peers: Map<string, WebSocket>;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      session.host.send(JSON.stringify({ type: "session-expired" }));
      for (const peerWs of session.peers.values()) {
        peerWs.send(JSON.stringify({ type: "session-expired" }));
      }
      sessions.delete(code);
    }
  }
}, 30_000);

wss.on("connection", (ws) => {
  let sessionCode: string | null = null;
  let peerId: string | null = null;
  let isHost = false;

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "create") {
      const code = genCode();
      sessions.set(code, {
        host: ws,
        passwordHash: msg.passwordHash,
        peers: new Map(),
        createdAt: Date.now(),
      });
      sessionCode = code;
      isHost = true;
      ws.send(JSON.stringify({ type: "created", code }));
      return;
    }

    if (msg.type === "join") {
      const session = sessions.get(msg.code);
      if (!session || session.passwordHash !== msg.passwordHash) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid code or password" }));
        return;
      }
      sessionCode = msg.code;
      peerId = genId();
      isHost = false;
      session.host.send(JSON.stringify({ type: "connection-request", peerId }));
      ws.send(JSON.stringify({ type: "awaiting-confirmation", peerId }));
      return;
    }

    if (msg.type === "confirm-peer" && isHost && sessionCode) {
      const session = sessions.get(sessionCode);
      if (!session) return;

      if (msg.accepted) {
        session.peers.set(msg.peerId, ws);
        const targetWs = session.peers.get(msg.peerId);
        targetWs?.send(JSON.stringify({ type: "joined", code: sessionCode, peerId: msg.peerId }));
      } else {
        const targetWs = session.peers.get(msg.peerId);
        targetWs?.send(JSON.stringify({ type: "error", message: "Host rejected connection" }));
        session.peers.delete(msg.peerId);
      }
      return;
    }

    if (msg.type === "signal" && sessionCode) {
      const session = sessions.get(sessionCode);
      if (!session) return;

      if (isHost && msg.targetPeerId) {
        const target = session.peers.get(msg.targetPeerId);
        target?.send(JSON.stringify({ type: "signal", data: msg.data, fromPeerId: "host" }));
      } else if (!isHost && peerId) {
        session.host.send(JSON.stringify({ type: "signal", data: msg.data, fromPeerId: peerId }));
      }
    }
  });

  ws.on("close", () => {
    if (!sessionCode) return;
    const session = sessions.get(sessionCode);
    if (!session) return;

    if (isHost) {
      for (const peerWs of session.peers.values()) {
        peerWs.send(JSON.stringify({ type: "host-left" }));
      }
      sessions.delete(sessionCode);
    } else if (peerId) {
      session.peers.delete(peerId);
      session.host.send(JSON.stringify({ type: "peer-left", peerId }));
    }
  });
});

console.log(`signaling server running on port ${port}`);
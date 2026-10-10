import http from "http"
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { randomInt } from "node:crypto";
import { type MsgJoinSession, type MsgConfirmPeer } from "./type.js";

dotenv.config();

const port = parseInt(process.env.PORT || "3000");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Signaling server is running\n");
});

const wss = new WebSocketServer({ port });

interface Peer {
  ws: WebSocket;
  id: string;
}

interface Session {
  host: WebSocket;
  password: string;
  peers: Map<string, WebSocket>;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function genPwd(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(chars.length)];
  }
  return result;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      session.host.send(JSON.stringify({ type: "session-expired" }));
      for (const peerWs of session.peers.values()) {
        peerWs.send(JSON.stringify({ type: "session-expired" }));
      }
      sessions.delete(id);
    }
  }
}, 30_000);

wss.on("connection", (ws) => {
  let globalSession: { id: string, password: string };
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
      const id = genId();
      const password = genPwd();
      sessions.set(id, {
        host: ws,
        password: password,
        peers: new Map(),
        createdAt: Date.now(),
      });
      globalSession = {id, password}
      isHost = true;
      ws.send(JSON.stringify({ type: "created", session: { id: id, password: password } }));
      return;
    }

    if (msg.type === "join") {
      const joinMsg = msg as MsgJoinSession;
      const session = sessions.get(joinMsg.id);
      if (!session || session.password !== joinMsg.password) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid session ID or password" }));
        return;
      }
      globalSession.id = joinMsg.id;
      peerId = joinMsg.clientId;
      isHost = false;
      session.host.send(JSON.stringify({ type: "connection-request", peerId }));
      ws.send(JSON.stringify({ type: "awaiting-confirmation", peerId }));
      return;
    }

    if (msg.type === "confirm-peer" && isHost && globalSession.id) {
      const confMsg = msg as MsgConfirmPeer;
      const session = sessions.get(globalSession.id);
      if (!session) return;

      if (confMsg.accepted) {
        session.peers.set(confMsg.peerId, ws);
        const targetWs = session.peers.get(confMsg.peerId);
        targetWs?.send(JSON.stringify({ type: "joined", code: globalSession.id, peerId: confMsg.peerId }));
      } else {
        const targetWs = session.peers.get(confMsg.peerId);
        targetWs?.send(JSON.stringify({ type: "error", message: "Host rejected connection" }));
        session.peers.delete(confMsg.peerId);
      }
      return;
    }

    if (msg.type === "signal" && globalSession.id) {
      const session = sessions.get(globalSession.id);
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
    if (!globalSession.id) return;
    const session = sessions.get(globalSession.id);
    if (!session) return;

    if (isHost) {
      for (const peerWs of session.peers.values()) {
        peerWs.send(JSON.stringify({ type: "host-left" }));
      }
      sessions.delete(globalSession.id);
    } else if (peerId) {
      session.peers.delete(peerId);
      session.host.send(JSON.stringify({ type: "peer-left", peerId }));
    }
  });
});

console.log(`signaling server running on port ${port}`);
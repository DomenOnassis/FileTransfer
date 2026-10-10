import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import { type MsgJoinSession, type MsgConfirmPeer } from "./type.js";

dotenv.config();

const port = parseInt(process.env.PORT || "3000");
const SESSION_JOIN_TTL_MS = 5 * 60 * 1000;
const MAX_BAD_PASSWORDS = 5;
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PWD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Signaling server is running\n");
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

interface Peer {
  ws: WebSocket;
  id: string;
}

interface Session {
  host: WebSocket;
  password: string;
  pending: Map<string, WebSocket>;y
  peers: Map<string, WebSocket>;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function randomString(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

function genSessionId(): string {
  let id: string;
  do {
    id = randomString(ID_ALPHABET, 8);
  } while (sessions.has(id));
  return id;
}

const genPwd = (length = 12) => randomString(PWD_ALPHABET, length);
const genPeerId = () => randomBytes(6).toString("hex");

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function send(ws: WebSocket | undefined, payload: object) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function destroySession(id: string, notify: object) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  for (const ws of [s.host, ...s.peers.values(), ...s.pending.values()]) {
    send(ws, notify);
    ws.close();
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.peers.size === 0 && now - s.createdAt > SESSION_JOIN_TTL_MS) {
      destroySession(id, { type: "session-expired" });
    }
  }
}, 30_000);

const alive = new WeakMap<WebSocket, boolean>();
setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) { ws.terminate(); continue; }
    alive.set(ws, false);
    ws.ping();
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
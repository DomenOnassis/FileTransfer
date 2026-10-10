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
  pending: Map<string, WebSocket>;
  peers: Map<string, WebSocket>;
  createdAt: number;
  badAttempts: number;
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
  ws.on("pong", () => alive.set(ws, true));

  let role: "none" | "host" | "peer" = "none";
  let sessionId: string | null = null;
  let peerId: string | null = null;
  let accepted = false;

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "create") {
      if (role !== "none") return;
      const id = genSessionId();
      const password = genPwd();
      sessions.set(id, {
        host: ws, password,
        pending: new Map(), peers: new Map(),
        createdAt: Date.now(), badAttempts: 0,
      });
      role = "host";
      sessionId = id;
      send(ws, { type: "created", session: { id, password } });
      return;
    }

    if (msg.type === "join") {
      if (role !== "none") return;
      if (typeof msg.id !== "string" || typeof msg.password !== "string" || typeof msg.peerId !== "string") return;

      const s = sessions.get(msg.id.toUpperCase());
      if (!s) {
        send(ws, { type: "error", message: "Invalid session ID or password" });
        return;
      }
      if (!safeEqual(s.password, msg.password)) {
        send(ws, { type: "error", message: "Invalid session ID or password" });
        if (++s.badAttempts >= MAX_BAD_PASSWORDS) {
          destroySession(msg.id.toUpperCase(), { type: "session-expired" });
        }
        return;
      }

      role = "peer";
      sessionId = msg.id.toUpperCase();
      peerId = msg.peerId;
      s.pending.set(peerId!, ws);

      const deviceName = typeof msg.deviceName === "string" ? msg.deviceName.slice(0, 40) : undefined;
      send(s.host, { type: "connection-request", peerId, deviceName });
      send(ws, { type: "awaiting-confirmation", peerId });
      return;
    }

    if (msg.type === "confirm-peer") {
      if (role !== "host" || !sessionId) return;
      const s = sessions.get(sessionId);
      if (!s || typeof msg.peerId !== "string") return;

      const target = s.pending.get(msg.peerId);
      if (!target) return;
      s.pending.delete(msg.peerId);

      if (msg.accepted === true) {
        s.peers.set(msg.peerId, target);
        send(target, { type: "joined", code: sessionId, peerId: msg.peerId });
      } else {
        send(target, { type: "error", message: "Host rejected connection" });
        target.close();
      }
      return;
    }

    if (msg.type === "signal") {
      if (!sessionId) return;
      const s = sessions.get(sessionId);
      if (!s) return;

      if (role === "host" && typeof msg.targetPeerId === "string") {
        send(s.peers.get(msg.targetPeerId),{ type: "signal", data: msg.data, fromPeerId: "host" });
      } else if (role === "peer" && peerId && s.peers.has(peerId)) {
        send(s.host, { type: "signal", data: msg.data, fromPeerId: peerId });
      }
      return;
    }
  });

  ws.on("close", () => {
    if (!sessionId) return;
    const s = sessions.get(sessionId);
    if (!s) return;

    if (role === "host") {
      destroySession(sessionId, { type: "host-left" });
    } else if (role === "peer" && peerId) {
      s.peers.delete(peerId);
      s.pending.delete(peerId);
      send(s.host, { type: "peer-left", peerId });
    }
  });
});

console.log(`signaling server running on port ${port}`);
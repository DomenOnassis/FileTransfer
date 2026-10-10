import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { randomInt, randomBytes, timingSafeEqual } from "node:crypto";

dotenv.config({ quiet: true });

const port = parseInt(process.env.PORT || "3003");
const SESSION_JOIN_TTL_MS = 5 * 60 * 1000;
const MAX_BAD_PASSWORDS = 5;
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PWD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const log = (tag: string, data?: object) => {
  const time = new Date().toISOString().slice(11, 23);
  console.log(`${time} [${tag}]`, data ? JSON.stringify(data) : "");
};

const server = http.createServer((req, res) => {
  log("http", { method: req.method, url: req.url });
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Signaling server is running\n");
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

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
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    log("send-skipped", { reason: ws ? "socket not open" : "no socket", payload });
  }
}

function destroySession(id: string, notify: object) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  log("session-destroyed", {
    id,
    notify,
    peers: s.peers.size,
    pending: s.pending.size,
    activeSessions: sessions.size,
  });
  for (const ws of [s.host, ...s.peers.values(), ...s.pending.values()]) {
    send(ws, notify);
    ws.close();
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.peers.size === 0 && now - s.createdAt > SESSION_JOIN_TTL_MS) {
      log("session-expired", { id });
      destroySession(id, { type: "session-expired" });
    }
  }
}, 30_000);

const alive = new WeakMap<WebSocket, boolean>();
setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      log("heartbeat-terminate");
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 30_000);

wss.on("connection", (ws, req) => {
  const conn = randomBytes(2).toString("hex");
  alive.set(ws, true);
  ws.on("pong", () => alive.set(ws, true));

  let role: "none" | "host" | "peer" = "none";
  let sessionId: string | null = null;
  let peerId: string | null = null;

  log("ws-connect", { conn, ip: req.socket.remoteAddress, clients: wss.clients.size });

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      log("ws-bad-json", { conn });
      return;
    }
    if (!msg || typeof msg.type !== "string") {
      log("ws-bad-message", { conn });
      return;
    }

    log("ws-in", { conn, type: msg.type, role, sessionId, peerId });

    if (msg.type === "create") {
      if (role !== "none") {
        log("create-ignored", { conn, role });
        return;
      }
      const id = genSessionId();
      const password = genPwd();
      sessions.set(id, {
        host: ws,
        password,
        pending: new Map(),
        peers: new Map(),
        createdAt: Date.now(),
        badAttempts: 0,
      });
      role = "host";
      sessionId = id;
      log("create", { conn, id, activeSessions: sessions.size });
      send(ws, { type: "created", session: { id, password } });
      return;
    }

    if (msg.type === "join") {
      if (role !== "none") {
        log("join-ignored", { conn, role });
        return;
      }
      if (typeof msg.id !== "string" || typeof msg.password !== "string") {
        log("join-malformed", { conn });
        send(ws, { type: "error", message: "Malformed join request" });
        return;
      }

      const id = msg.id.toUpperCase();
      const s = sessions.get(id);
      if (!s) {
        log("join-no-session", { conn, id });
        send(ws, { type: "error", message: "Invalid session ID or password" });
        return;
      }
      if (!safeEqual(s.password, msg.password)) {
        s.badAttempts++;
        log("join-bad-password", { conn, id, badAttempts: s.badAttempts });
        send(ws, { type: "error", message: "Invalid session ID or password" });
        if (s.badAttempts >= MAX_BAD_PASSWORDS) {
          log("join-lockout", { id });
          destroySession(id, { type: "session-expired" });
        }
        return;
      }

      role = "peer";
      sessionId = id;
      peerId = genPeerId();
      s.pending.set(peerId, ws);

      const deviceName = typeof msg.deviceName === "string" ? msg.deviceName.slice(0, 40) : undefined;
      log("join", { conn, id, peerId, deviceName, pending: s.pending.size });
      send(s.host, { type: "connection-request", peerId, deviceName });
      send(ws, { type: "awaiting-confirmation", peerId });
      return;
    }

    if (msg.type === "confirm-peer") {
      if (role !== "host" || !sessionId) {
        log("confirm-rejected", { conn, reason: "not host or no session" });
        return;
      }
      const s = sessions.get(sessionId);
      if (!s || typeof msg.peerId !== "string") {
        log("confirm-rejected", { conn, reason: "no session or bad peerId", peerId: msg.peerId });
        return;
      }

      const target = s.pending.get(msg.peerId);
      if (!target) {
        log("confirm-rejected", {
          conn,
          reason: "peerId not pending",
          peerId: msg.peerId,
          pending: [...s.pending.keys()],
        });
        return;
      }
      s.pending.delete(msg.peerId);

      if (msg.accepted === true) {
        s.peers.set(msg.peerId, target);
        log("confirm-accepted", { sessionId, peerId: msg.peerId, peers: s.peers.size });
        send(target, { type: "joined", code: sessionId, peerId: msg.peerId });
      } else {
        log("confirm-declined", { sessionId, peerId: msg.peerId });
        send(target, { type: "error", message: "Host rejected connection" });
        target.close();
      }
      return;
    }

    if (msg.type === "signal") {
      if (!sessionId) {
        log("signal-dropped", { conn, reason: "no session" });
        return;
      }
      const s = sessions.get(sessionId);
      if (!s) {
        log("signal-dropped", { conn, reason: "session gone" });
        return;
      }

      if (role === "host" && typeof msg.targetPeerId === "string") {
        log("signal-relay", { from: "host", to: msg.targetPeerId, sessionId });
        send(s.peers.get(msg.targetPeerId), { type: "signal", data: msg.data, fromPeerId: "host" });
      } else if (role === "peer" && peerId && s.peers.has(peerId)) {
        log("signal-relay", { from: peerId, to: "host", sessionId });
        send(s.host, { type: "signal", data: msg.data, fromPeerId: peerId });
      } else {
        log("signal-dropped", { conn, reason: "not allowed", role, peerId });
      }
      return;
    }

    log("ws-unknown-type", { conn, type: msg.type });
  });

  ws.on("close", (code) => {
    log("ws-close", { conn, code, role, sessionId, peerId, clients: wss.clients.size });
    if (!sessionId) return;
    const s = sessions.get(sessionId);
    if (!s) return;

    if (role === "host") {
      destroySession(sessionId, { type: "host-left" });
    } else if (role === "peer" && peerId) {
      s.peers.delete(peerId);
      s.pending.delete(peerId);
      log("peer-left", { sessionId, peerId, peers: s.peers.size });
      send(s.host, { type: "peer-left", peerId });
    }
  });

  ws.on("error", (err) => {
    log("ws-error", { conn, message: err.message });
  });
});

server.listen(port, () => {
  log("listening", { port });
});
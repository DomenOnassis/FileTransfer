const WS_URL = import.meta.env.VITE_SIGNALING_URL ?? "ws://localhost:3003";
const ICE_SERVER = import.meta.env.ICE_SERVER_URL ?? "stun:stun.l.google.com:19302"

const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: ICE_SERVER }] };

const CHUNK = 16 * 1024;            // 16KB
const BLOCK = 1024 * 1024;          // 1MB
const HIGH_WATER = 4 * 1024 * 1024; // 4MB 
const LOW_WATER = 1024 * 1024;      // 1MB

type Status =
  | "idle"
  | "connecting"
  | "waiting"
  | "awaiting-confirmation"
  | "connected"
  | "error"
  | "closed";

type Link = "none" | "connecting" | "open" | "closed";
type Peer = { peerId: string; deviceName?: string };

export type Incoming = {
    id: string;
    name: string;
    size: string;
    done: number;
    state: "active" | "done" | "failed";
}

type Rx = {
    entry: Incoming;
    name: string;
    writer?: FileSystemWritableFileStream;
    chunks: ArrayBuffer[];
}

function safeName(name: string) {
    const base = name.split(/[\\/]/).pop() ?? "";
    const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").trim(); // null | invalid char
    if(!cleaned || cleaned === "." || cleaned === "..") return "file";
    return cleaned.slice(0, 200);
}

async function uniqueFile(dir: FileSystemDirectoryHandle, name: string) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    let n = 1;
    for (;;) {
        try {
            await dir.getFileHandle(candidate);
            candidate = `${stem} (${n++})${ext}`;
        } catch {
            return dir.getFileHandle(candidate, { create: true });
        }
    }
}

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export class Session {
    status = $state<Status>("idle");
    role = $state<"host" | "peer" | null>(null);
    info = $state<{ id: string; password: string } | null>(null);
    requests = $state<Peer[]>([]);
    peers = $state<Peer[]>([]);
    error = $state<string | null>(null);

    #ws?: WebSocket;

    async host() {
        this.#reset("host");
        await this.#open();
        this.#send({ type: "create" });
    }

    async join(id: string, password: string, deviceName?: string) {
        this.#reset("peer");
        await this.#open();
        this.#send({ type: "join", id: id.trim(), password, deviceName });
    }

    respond(peerId: string, accepted: boolean) {
        const req = this.requests.find((r) => r.peerId === peerId);
        this.requests = this.requests.filter((r) => r.peerId !== peerId);
        this.#send({ type: "confirm-peer", peerId, accepted });
        if (accepted && req) {
        this.peers.push(req);
        this.status = "connected";
        }
    }

    close() {
        this.#ws?.close();
        this.#ws = undefined;
        this.status = "closed";
    }

    #reset(role: "host" | "peer") {
        this.#ws?.close();
        this.role = role;
        this.info = null;
        this.requests = [];
        this.peers = [];
        this.error = null;
    }

    #open() {
        this.status = "connecting";
        return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        this.#ws = ws;
        ws.onopen = () => resolve();
        ws.onerror = () => {
            this.#fail("Cannot reach signaling server");
            reject(new Error("ws error"));
        };
        ws.onclose = () => {
            if (this.status !== "error") this.status = "closed";
        };
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                console.log("[ws in]", msg);
                this.#onMessage(msg);
            } catch (err) {
                console.error("[ws] handler failed", err);
            }
        };
        });
    }

    #send(payload: object) {
        if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws.send(JSON.stringify(payload));
        }
    }

    #fail(message: string) {
        this.error = message;
        this.status = "error";
    }

    #onMessage(msg: any) {
        switch(msg.type) {
            case "created":
                this.info = msg.session;
                this.status = "waiting";
                break;

            case "connection-request":
                this.requests.push({ peerId: msg.peerId, deviceName: msg.deviceName });
                break;

            case "peer-left":
                this.requests = this.requests.filter((r) => r.peerId !== msg.peerId);
                this.peers = this.peers.filter((p) => p.peerId !== msg.peerId);
                if (this.peers.length === 0) this.status = "waiting";
                break;

            case "awaiting-confirmation":
                this.status = "awaiting-confirmation";
                break;

            case "joined":
                this.info = { id: msg.code, password: "" };
                this.status = "connected";
                break;

            case "host-left":
                this.#fail("Host left the session");
                break;

            case "session-expired":
                this.#fail("Session expired");
                break;

            case "error":
                this.#fail(msg.message);
                break;
        }
    }
}
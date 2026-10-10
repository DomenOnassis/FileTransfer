const WS_URL = import.meta.env.VITE_SIGNALING_URL ?? "ws://localhost:3000";

type Status =
  | "idle"
  | "connecting"
  | "waiting"
  | "awaiting-confirmation"
  | "connected"
  | "error"
  | "closed";

type Peer = { peerId: string; deviceName?: string };

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
            // keep "error" visible; otherwise mark closed
            if (this.status !== "error") this.status = "closed";
        };
        ws.onmessage = (e) => {
            try { this.#onMessage(JSON.parse(e.data)); } catch {}
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
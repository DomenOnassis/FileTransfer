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
type Peer = { peerId: string; deviceName?: string; link?: Link };

export type Incoming = {
    id: string;
    name: string;
    size: number;
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
    for(;;) {
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
    link = $state<Link>("none");
    incoming = $state<Incoming[]>([]);
    sending = $state(false);
    progress = $state(0);
    saveDir = $state.raw<FileSystemDirectoryHandle | null>(null);

    #ws?: WebSocket;
    #pcs = new Map<string, RTCPeerConnection>();
    #channels = new Map<string, RTCDataChannel>();
    #queues = new Map<string, Promise<void>>();
    #ice = new Map<string, RTCIceCandidateInit[]>();
    #rxChain: Promise<void> = Promise.resolve();
    #rx: Rx | null = null;

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
        if(accepted && req) {
            this.peers.push({ ...req, link: "connecting" });
            this.status = "connected";
            this.#createPc(peerId, true);
        }
    }

    async send(files: File[]) {
        const targets = [...this.#channels.values()].filter((ch) => ch.readyState === "open");
        if(this.sending || targets.length === 0 || files.length === 0) return;

        this.sending = true;
        this.progress = 0;
        const total = files.reduce((n, f) => n + f.size, 0) * targets.length;
        let sent = 0;

        try {
            for(const file of files) {
                const id = crypto.randomUUID();
                const header = JSON.stringify({t: "start", id, name: file.name, size: file.size });
                for(const ch of targets) if(ch.readyState === "open") ch.send(header);
                for(let offset = 0; offset < file.size; offset += BLOCK) {
                    const block = await file.slice(offset, offset + BLOCK).arrayBuffer();
                    for(let i = 0; i < block.byteLength; i += CHUNK) {
                        const len = Math.min(CHUNK, block.byteLength - i);
                        for(const ch of targets) {
                            await this.#drain(ch);
                            if(ch.readyState === "open") ch.send(new Uint8Array(block, i, len));
                        }
                        sent += len * targets.length;
                        this.progress = total ? Math.round((sent / total) * 100) : 100;
                    }
                }
                const footer = JSON.stringify({ t: "end", id });
                for(const ch of targets) if(ch.readyState === "open") ch.send(footer);
            }
            this.progress = 100;
        } finally {
            this.sending = false;
        }
    }

    close() {
        this.#teardown();
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
        this.link = "none";
        this.incoming = [];
        this.sending = false;
        this.progress = 0;
    }

    #teardown() {
        for(const pc of this.#pcs.values()) pc.close();
        this.#pcs.clear();
        this.#channels.clear();
        this.#queues.clear();
        this.#ice.clear();
        this.#rxAbort();
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
            if(this.status !== "error") this.status = "closed";
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
        if(this.#ws?.readyState === WebSocket.OPEN) {
            this.#ws.send(JSON.stringify(payload));
        }
    }

    #fail(message: string) {
        this.#teardown();
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
                this.#pcs.get(msg.peerId)?.close();
                this.#pcs.delete(msg.peerId);
                this.#channels.delete(msg.peerId);
                this.#ice.delete(msg.peerId);
                this.requests = this.requests.filter((r) => r.peerId !== msg.peerId);
                this.peers = this.peers.filter((p) => p.peerId !== msg.peerId);
                if(this.peers.length === 0) this.status = "waiting";
                break;

            case "awaiting-confirmation":
                this.status = "awaiting-confirmation";
                break;

            case "joined":
                this.info = { id: msg.code, password: "" };
                this.status = "connected";
                this.link = "connecting";
                break;

            case "signal":
                console.log("[signal in]", msg.data?.sdp?.type ?? (msg.data?.candidate ? "candidate" : "?"));
                this.#enqueue(msg.fromPeerId, () => this.#handleSignal(msg.fromPeerId, msg.data));
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

    #createPc(key: string, initiator: boolean) {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        this.#pcs.set(key, pc);

        pc.onicecandidate = (e) => {
            if (e.candidate) this.#signal(key, { candidate: e.candidate.toJSON() });
        };
        pc.onicecandidateerror = (e) => console.log("[candidate-error]", key, (e as RTCPeerConnectionIceErrorEvent).errorText);
        pc.oniceconnectionstatechange = () => console.log("[ice]", key, pc.iceConnectionState);
        pc.onconnectionstatechange = () => {
            console.log("[pc]", key, pc.connectionState);
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                this.#setLink(key, "closed");
            }
        };

        if(initiator) {
            this.#bindChannel(key, pc.createDataChannel("files"));
            this.#enqueue(key, async () => {
                await pc.setLocalDescription(await pc.createOffer());
                this.#signal(key, { sdp: pc.localDescription });
            });
        } else {
            pc.ondatachannel = (e) => this.#bindChannel(key, e.channel);
        }
        return pc;
    }

    #bindChannel(key: string, ch: RTCDataChannel) {
        ch.binaryType = "arraybuffer";
        ch.bufferedAmountLowThreshold = LOW_WATER;
        this.#channels.set(key, ch);
        ch.onopen = () => this.#setLink(key, "open");
        ch.onclose = () => {
            this.#channels.delete(key);
            this.#setLink(key, "closed");
            if(this.role === "peer") this.#rxAbort();
        };
        ch.onmessage = (e) => this.#onData(e.data);
    }

    #setLink(key: string, link: Link) {
        if(this.role === "host") {
            const p = this.peers.find((x) => x.peerId === key);
            if(p) p.link = link;
        } else {
            this.link = link;
        }
    }

    async #handleSignal(fromKey: string, data: any) {
        const key = this.role === "host" ? fromKey : "host";
        if(this.role === "host" && !this.#pcs.has(key)) return;
        const pc = this.#pcs.get(key) ?? this.#createPc(key, false);

        if(data?.sdp) {
            await pc.setRemoteDescription(data.sdp);
            const queued = this.#ice.get(key) ?? [];
            this.#ice.delete(key);
            for(const c of queued) await pc.addIceCandidate(c);
            if(data.sdp.type === "offer") {
                await pc.setLocalDescription(await pc.createAnswer());
                this.#signal(key, { sdp: pc.localDescription });
            }
        } else if(data?.candidate) {
            if(pc.remoteDescription) {
                await pc.addIceCandidate(data.candidate);
            } else {
                this.#ice.set(key, [...(this.#ice.get(key) ?? []), data.candidate]);
            }
        }
    }

    #signal(key: string, data: object) {
        this.#send(
            this.role === "host"
                ? { type: "signal", targetPeerId: key, data }
                : { type: "signal", data }
        );
    }

    #enqueue(key: string, fn: () => Promise<void>) {
        const prev = this.#queues.get(key) ?? Promise.resolve();
        this.#queues.set(key, prev.then(fn).catch((e) => console.error("[rtc]", e)));
    }

    #drain(ch: RTCDataChannel) {
        if(ch.bufferedAmount <= HIGH_WATER) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const done = () => {
                ch.removeEventListener("bufferedamountlow", done);
                ch.removeEventListener("close", done);
                resolve();
            };
            ch.addEventListener("bufferedamountlow", done);
            ch.addEventListener("close", done);
        });
    }

    #onData(data: string | ArrayBuffer) {
        this.#rxChain = this.#rxChain
            .then(() => this.#handle(data))
            .catch((e) => {
                console.error("[rx]", e);
                this.#rxAbort();
            })
    }

    async #handle(data: string | ArrayBuffer) {
        if(typeof data === "string") {
            const m = JSON.parse(data);

            if(m.t === "start") {
                if (typeof m.id !== "string" || typeof m.name !== "string" || typeof m.size !== "number") return;
                this.#rxAbort();
                const name = safeName(m.name);
                this.incoming.push({ id: m.id, name, size: m.size, done: 0, state: "active" });
                const entry = this.incoming[this.incoming.length - 1];
                const rx: Rx = { entry, name, chunks: [] };
                this.#rx = rx;
                if(this.saveDir) {
                    const handle = await uniqueFile(this.saveDir, name);
                    rx.writer = await handle.createWritable();
                }
            } else if(m.t === "end") {
                const rx = this.#rx;
                if(!rx || rx.entry.id !== m.id) return;
                this.#rx = null;
                if(rx.entry.done !== rx.entry.size) {
                    rx.writer?.abort().catch(() => {});
                    rx.entry.state = "failed";
                    return;
                }
                if(rx.writer) await rx.writer.close();
                else download(new Blob(rx.chunks), rx.name);
                rx.entry.state = "done";
            }
            return;
        }
        const rx = this.#rx;
        if(!rx) return;
        if(rx.writer) await rx.writer.write(data);
        else rx.chunks.push(data);
        rx.entry.done += data.byteLength;
    }

    #rxAbort() {
        const rx = this.#rx;
        if(!rx) return;
        this.#rx = null;
        rx.writer?.abort().catch(() => {});
        rx.entry.state = "failed";
    }
}
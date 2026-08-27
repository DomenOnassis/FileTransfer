import dotenv from 'dotenv';
dotenv.config();
const ICE_SERVERS = [{ urls: process.env.ICE_URL }];
export class PeerSession {
    ws;
    pc;
    channel = null;
    isInitiator = false;
    onData = () => { };
    onOpen = () => { };
    onCode = () => { };
    constructor(signalingUrl) {
        this.ws = new WebSocket(signalingUrl);
        this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.pc.onicecandidate = (e) => {
            if (e.candidate)
                this.sendSignal({ candidate: e.candidate });
        };
        this.ws.onmessage = (ev) => this.handleMessage(JSON.parse(ev.data));
    }
    create() {
        this.isInitiator = true;
        this.ws.onopen = () => this.ws.send(JSON.stringify({ type: "create" }));
        this.channel = this.pc.createDataChannel("file");
        this.setupChannel(this.channel);
    }
    join(code) {
        this.isInitiator = false;
        this.ws.onopen = () => this.ws.send(JSON.stringify({ type: "join", code }));
        this.pc.ondatachannel = (e) => {
            this.channel = e.channel;
            this.setupChannel(e.channel);
        };
    }
    setupChannel(channel) {
        channel.binaryType = "arraybuffer";
        channel.onopen = () => this.onOpen();
        channel.onmessage = (e) => this.onData(e.data);
    }
    async handleMessage(msg) {
        if (msg.type === "created") {
            this.onCode(msg.code);
        }
        if (msg.type === "peer-joined" && this.isInitiator) {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            this.sendSignal({ sdp: offer });
        }
        if (msg.type === "signal") {
            const data = msg.data;
            if (data.sdp) {
                await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                if (data.sdp.type === "offer") {
                    const answer = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(answer);
                    this.sendSignal({ sdp: answer });
                }
            }
            if (data.candidate) {
                await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        }
    }
    sendSignal(data) {
        this.ws.send(JSON.stringify({ type: "signal", data }));
    }
    sendFile(file, chunkSize = 16 * 1024) {
        if (!this.channel)
            return;
        const channel = this.channel;
        let offset = 0;
        channel.send(JSON.stringify({ meta: true, name: file.name, size: file.size }));
        const reader = new FileReader();
        const readSlice = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };
        reader.onload = async () => {
            if (channel.bufferedAmount > 8 * chunkSize) {
                await new Promise((r) => setTimeout(r, 20));
            }
            channel.send(reader.result);
            offset += chunkSize;
            if (offset < file.size)
                readSlice();
        };
        readSlice();
    }
}
//# sourceMappingURL=peer_connection.js.map
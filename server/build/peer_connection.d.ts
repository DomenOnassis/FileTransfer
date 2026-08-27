export declare class PeerSession {
    ws: WebSocket;
    pc: RTCPeerConnection;
    channel: RTCDataChannel | null;
    isInitiator: boolean;
    onData: (chunk: ArrayBuffer) => void;
    onOpen: () => void;
    onCode: (code: string) => void;
    constructor(signalingUrl: string);
    create(): void;
    join(code: string): void;
    private setupChannel;
    private handleMessage;
    private sendSignal;
    sendFile(file: File, chunkSize?: number): void;
}
//# sourceMappingURL=peer_connection.d.ts.map
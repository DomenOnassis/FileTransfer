export type MsgJoinSession = {
    id: string,
    password: string,
    clientId: string
};

export type MsgConfirmPeer = {
    accepted: boolean,
    peerId: string
};
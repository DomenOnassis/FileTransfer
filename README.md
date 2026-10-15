<a name="top"></a>

<br />
<div align="center">
  <h3 align="center">FileTransfer</h3>

  <p align="center">
    Direct peer-to-peer file transfer in the browser
    <br />
    <a href="#how-it-works"><strong>How it works »</strong></a>
    <br />
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Svelte-5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

# FileTransfer

<details>
  <summary>Table of contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About the project</a>
      <ul>
        <li><a href="#why-filetransfer">Why FileTransfer</a></li>
        <li><a href="#built-with">Built with</a></li>
      </ul>
    </li>
    <li><a href="#how-it-works">How it works</a>
      <ul>
        <li><a href="#use-case">Use case</a></li>
        <li><a href="#session-generation">Session generation</a></li>
        <li><a href="#file-transfer">File transfer</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#environment-variables">Environment variables</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#web-application">Web application</a></li>
        <li><a href="#signaling-server-protocol">Signaling server protocol</a></li>
      </ul>
    </li>
    <li><a href="#security">Security</a></li>
    <li><a href="#browser-support">Browser support</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About the project <a name="about-the-project"></a>
<br>

<img width="2770" height="1560" alt="Home screen" src="https://github.com/user-attachments/assets/f78a7676-0030-4cb1-9698-90b6a413f08a" />

<img width="2770" height="1560" alt="Host screen" src="https://github.com/user-attachments/assets/eb4157ca-e27d-4785-a89a-96e885265705" />

<img width="2770" height="1560" alt="Receiver screen" src="https://github.com/user-attachments/assets/62698133-9420-42aa-a23d-6f7f533db616" />

<img width="1537" height="917" alt="image" src="https://github.com/user-attachments/assets/e7578043-c901-46a0-8436-f8bbd86e54da" />

<img width="1511" height="1133" alt="image" src="https://github.com/user-attachments/assets/4a62bea3-f165-4d86-801e-665cf5004278" />

<img width="1575" height="1192" alt="image" src="https://github.com/user-attachments/assets/c0c9f33a-058f-40ae-8214-030481c7cc0a" />

<img width="1577" height="1086" alt="image" src="https://github.com/user-attachments/assets/718322e2-6d35-4458-aa07-d0522e31b9ec" />

FileTransfer is a small web application for sending files directly from one device to another. There are no accounts, no uploads to a cloud and no size limits imposed by a server. One device starts a session and gets an ID and a password, the other enters them, the host approves, and the files travel straight between the two browsers over WebRTC.

The only job of the server is to introduce the devices to each other. Once the connection is established, file data never touches it.

### Why FileTransfer <a name="why-filetransfer"></a>

* **Direct transfer:** Files go from browser to browser. The server only relays the small setup messages needed to establish the connection.
* **Encrypted in transit:** WebRTC data channels are always encrypted (DTLS), so file contents are protected between the two devices.
* **Host approval:** Nobody can receive anything unless the host explicitly accepts their connection request.
* **One-to-many:** One host can serve several receivers at the same time, each with its own direct connection.
* **Parallel transfers:** Multiple files stream at once, so a small file does not have to wait behind a large one.
* **Large files:** Chunked sending with backpressure keeps memory use flat, and Chromium browsers can stream straight to a chosen folder on disk.
* **Nothing to install:** It runs in the browser on desktop and mobile.

### Built with <a name="built-with"></a>

* ![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
* ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
* ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
* ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
* ![WebSockets](https://img.shields.io/badge/WebSockets-ws-010101?logo=socketdotio&logoColor=white)
* ![WebRTC](https://img.shields.io/badge/WebRTC-Data_Channels-333333?logo=webrtc&logoColor=white)

<p align="right">(<a href="#top">back to top</a>)</p>

## How it works <a name="how-it-works"></a>

### Use case <a name="use-case"></a>

* Device B has files and wants to send them to device A.
* B presses **Start session** and gets a unique session ID and password.
* A opens the **Connect** page and enters the ID and password from B.
* B sees the connection request and confirms it.
* A and B are connected.
* B selects files and presses **Send**.
* B sends the files directly to A.
* A receives the files, either into a chosen folder or as normal browser downloads.
* Either side exits and the session ends.

Connections can be one-to-many. Devices A and B can both join a session hosted by C, and both receive files from C at once.

### Session generation <a name="session-generation"></a>

```
[ START SESSION ] ---> generates a session with an ID and a password
```

The real-time server (WebSockets) connects the devices using the session ID, checks the password, and waits for the host's confirmation. That is its only role.

```
Host                        Server                      Receiver
  |--- create ---------------->|                            |
  |<-- created (id, password) -|                            |
  |                            |<--- join (id, password) ---|
  |<-- connection-request -----|--- awaiting-confirmation ->|
  |--- confirm-peer (accept) ->|                            |
  |                            |--- joined ---------------->|
  |--- signal (offer) -------->|--- signal (offer) -------->|
  |<-- signal (answer) --------|<-- signal (answer) --------|
  |<-- signal (ICE) -----------|<-- signal (ICE) -----------|
  |                                                         |
  |<============ direct WebRTC data channel ===============>|
```

Session notes:

* A session that nobody joins expires after 5 minutes.
* After 5 wrong passwords the session is destroyed.
* Closing the host page ends the session for everyone.
* Session IDs use an alphabet without look-alike characters (no `0`, `O`, `1`, `I`), so they are easy to read and type.

### File transfer <a name="file-transfer"></a>

The sender selects files and presses **Send**. Each file is sent on its own WebRTC data channel as a `start` message, a series of 16 KB binary chunks, and an `end` message. Up to 3 files are sent in parallel.

The receiver picks a save folder (or uses normal downloads) and the files are written as they arrive. Existing files are never overwritten; a duplicate name is saved as `name (1).ext`.

<p align="right">(<a href="#top">back to top</a>)</p>

## Getting started <a name="getting-started"></a>

These instructions get the signaling server and the web app running on your own machine.

### Prerequisites <a name="prerequisites"></a>

Make sure you have the following installed:

* [Node.js](https://nodejs.org/en) (includes npm)
* [Git](https://git-scm.com/)

### Installation <a name="installation"></a>

1. Clone the repository
   ```sh
   git clone https://github.com/YOUR_USERNAME/FileTransfer.git
   cd FileTransfer
   ```
2. Install the packages for the backend and the frontend separately
   ```sh
   cd backend
   npm install

   cd ../frontend
   npm install
   ```
3. Create the environment files described below.
4. Start both parts (see [Usage](#web-application)).

### Environment variables <a name="environment-variables"></a>

**Backend** (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3003` | Port the signaling server listens on |

**Frontend** (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SIGNALING_URL` | `wss://localhost:3003` | WebSocket address of the signaling server. |
| `VITE_ICE_SERVER_URL` | `stun:stun.l.google.com:19302` | STUN server used to discover public addresses |

Vite only exposes variables that start with `VITE_`, and `.env` changes require restarting the dev server.

<p align="right">(<a href="#top">back to top</a>)</p>

## Usage

### Web application <a name="web-application"></a>

Start the backend and the frontend, each in its own terminal:

```sh
cd backend
npm start
```

```sh
cd frontend
npm run dev
```

By default the signaling server runs on `http://localhost:3003/` and the frontend on `http://localhost:5173/`. Opening the signaling server address in a browser shows a short status message, which is a quick way to check that it is running.

**To send files (host)**

1. Open the home page and press **Host**.
2. Share the Session ID and Password with the receiver.
3. Accept the connection request when it appears.
4. Wait until the device shows **Active**, then choose files and press **Send Encrypted Files**.

**To receive files**

1. Open the home page and press **Connect**.
2. Enter the Session ID and Password from the host and press **Connect to Session**.
3. Wait for the host to approve.
4. Optionally press **Browse** to pick a save folder (Chromium browsers only).
5. Files appear in the incoming list with live progress.

To test on a single machine, open the host and the receiver in separate tabs. Open several receiver tabs to try the one-to-many case.

### Signaling server protocol <a name="signaling-server-protocol"></a>

All messages are JSON over WebSocket.

| Message | Direction | Purpose |
|---|---|---|
| `create` | host → server | Start a new session |
| `created` | server → host | Returns the session ID and password |
| `join` | receiver → server | Ask to join with an ID and password |
| `connection-request` | server → host | A receiver wants to join |
| `awaiting-confirmation` | server → receiver | Password accepted, waiting for the host |
| `confirm-peer` | host → server | Accept or reject a receiver |
| `joined` | server → receiver | The host accepted |
| `signal` | both, relayed | WebRTC offer, answer and ICE candidates |
| `peer-left` | server → host | A receiver disconnected |
| `host-left` | server → receivers | The host disconnected, session ended |
| `session-expired` | server → all | Nobody joined in time, or too many wrong passwords |
| `error` | server → client | Invalid ID or password, host rejected, malformed request |

Peer IDs are generated by the server, and `signal` messages are only relayed for peers the host has accepted.

<p align="right">(<a href="#top">back to top</a>)</p>

## Security

**What is protected**

* File contents travel over WebRTC data channels, which are always encrypted and integrity-protected (DTLS). The signaling server never sees file data.
* With a TURN relay, the relay only carries already-encrypted traffic.
* Every receiver must be approved by the host, and no signals are relayed before that.
* Passwords are 12 random characters from a cryptographic generator, and are compared in constant time.
* File names are stripped of path separators and control characters, and the receiver rejects more data than a file declared.

**What to be aware of**

* The signaling server is trusted during the handshake. A malicious server (or anyone who can alter traffic on a plain `ws://` connection) could tamper with the connection setup.
* Encrypting the files again with a key derived from the session password would not help, because the server generates and knows that password.
* A short verification code, shown on both screens and compared by the users, would close this gap completely.

<p align="right">(<a href="#top">back to top</a>)</p>

## Browser support <a name="browser-support"></a>

| Feature | Chrome / Edge | Firefox / Safari | Brave |
|---|---|---|---|
| Sessions and WebRTC transfer | Yes | Yes | Yes |
| Save to a chosen folder | Yes | No, downloads instead | Only with the flag enabled |

* **Folder saving** uses the File System Access API, available in Chromium browsers on HTTPS or `localhost`. Brave disables it by default; it can be enabled at `brave://flags/#file-system-access-api`.
* **Download fallback:** without folder access, each file is held in memory and downloaded when complete, so very large files may not fit.
* **Brave:** the default WebRTC IP handling policy can stop two devices on the same network from connecting. Setting it to "Default" in `brave://settings/privacy` fixes this.
* **Strict networks:** STUN alone works on most home networks, but corporate networks and mobile data may need a TURN server.

<p align="right">(<a href="#top">back to top</a>)</p>

## Contact

If you have questions or suggestions, open a new [Issue](https://github.com/DomenOnassis/FileTransfer/issues).

Link to the project: https://github.com/DomenOnassis/FileTransfer

<p align="right">(<a href="#top">back to top</a>)</p>

# FileTransfer

The project consists of 2 different methods of file transfer:

- P2P file transfer via a shared code between two anonymous accounts (nothing saved on server)
- File transfer via QR code sequence

Both methods are meant for simple file transfers between devices wirelessly and efficiently.

## 1. P2P file transfer
### 1.1 Usecase
- Device A wants to access the files stored on device B.
- A starts a session and generates a unique ID and password.
- B starts a session and generates a unique ID and password.
- A enters the ID from B
- A enters the password from B
- B confirms
- A and B are connected
- B selects files
- B sends the files directly to A
- A recieves the files
- A exits or cancels the session

Connections could be N:1, meaning A and B could connect to C and both receive files from C at once.

### 1.2 Session generation
[ START SESSION BUTTON ] ---> generates a session with ID and password

The real-time server (Websockets) connects the devices via session ID and confirms via password and host confirmation.
That is its only role.

The sender selects the files and presses [ SEND ], then the files are encrypted and sent via WebRTC.

Recipient selects save folder, decrypts and saves the files.


### 1.3 How are files sent?

### 1.4 How are files downloaded?

## 2. FT via QR code sequence

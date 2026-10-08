# FileTransfer

<img width="2770" height="1560" alt="image" src="https://github.com/user-attachments/assets/f78a7676-0030-4cb1-9698-90b6a413f08a" />

<img width="2770" height="1560" alt="image" src="https://github.com/user-attachments/assets/eb4157ca-e27d-4785-a89a-96e885265705" />

<img width="2770" height="1560" alt="image" src="https://github.com/user-attachments/assets/4730a550-bc07-4e24-99e0-58a057ad4792" />


## 1. RTC P2P file transfer
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

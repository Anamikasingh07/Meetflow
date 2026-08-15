import { io } from "socket.io-client";

const socket = io(
    "https://meetflow-server-nr0i.onrender.com"
);

socket.on(
    "connect",
    () => {
        console.log(
            "Socket connected:",
            socket.id
        );
    }
);

socket.on(
    "disconnect",
    () => {
        console.log(
            "Socket disconnected"
        );
    }
);

export default socket;
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(
    cors({
        origin: "https://meetflow-m2t5.onrender.com",
        methods: ["GET", "POST"],
    })
);

app.use(express.json());

// ==========================================
// SERVER
// ==========================================

const server = http.createServer(app);

// ==========================================
// SOCKET.IO
// ==========================================

const io = new Server(server, {
    cors: {
        origin: "https://meetflow-m2t5.onrender.com",
        methods: ["GET", "POST"],
    },
});

// ==========================================
// ACTIVE MEETINGS
// ==========================================

const activeMeetings = new Set();

// ==========================================
// GENERATE MEETING ID
// ==========================================

function generateMeetingId() {
    const characters =
        "abcdefghijklmnopqrstuvwxyz0123456789";

    let id = "";

    for (let i = 0; i < 6; i++) {
        id += characters.charAt(
            Math.floor(
                Math.random() *
                    characters.length
            )
        );
    }

    return id;
}

// ==========================================
// CREATE MEETING
// ==========================================

app.post(
    "/api/meetings/create",
    (req, res) => {

        let meetingId;

        do {
            meetingId =
                generateMeetingId();
        } while (
            activeMeetings.has(
                meetingId
            )
        );

        activeMeetings.add(
            meetingId
        );

        console.log(
            "Meeting created:",
            meetingId
        );

        res.json({
            success: true,
            meetingId,
        });
    }
);

// ==========================================
// CHECK MEETING
// ==========================================

app.get(
    "/api/meetings/:meetingId",
    (req, res) => {

        const meetingId =
            req.params.meetingId;

        const exists =
            activeMeetings.has(
                meetingId
            );

        res.json({
            exists,
        });
    }
);

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

    res.send(
        "MeetFlow server is running"
    );
});

// ==========================================
// SOCKET CONNECTION
// ==========================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "User connected:",
            socket.id
        );

        // ======================================
        // JOIN ROOM
        // ======================================

        socket.on(
            "join-room",
            ({
                roomId,
                name,
                micOn,
                cameraOn,
            }) => {

                console.log(
                    "Join request:",
                    socket.id,
                    "Room:",
                    roomId,
                    "Name:",
                    name
                );

                // ----------------------------------
                // CHECK MEETING
                // ----------------------------------

                if (
                    !activeMeetings.has(
                        roomId
                    )
                ) {

                    socket.emit(
                        "meeting-invalid"
                    );

                    console.log(
                        "Invalid meeting:",
                        roomId
                    );

                    return;
                }

                // ----------------------------------
                // PREVENT DUPLICATE JOIN
                // ----------------------------------

                if (
                    socket.rooms.has(
                        roomId
                    )
                ) {

                    console.log(
                        "Already in room:",
                        socket.id,
                        roomId
                    );

                    return;
                }

                // ----------------------------------
                // GET EXISTING USERS
                // ----------------------------------

                const room =
                    io.sockets.adapter.rooms.get(
                        roomId
                    );

                const existingUsers =
                    room
                        ? [...room]
                        : [];

                console.log(
                    "Existing users:",
                    existingUsers
                );

                // ----------------------------------
                // SAVE USER DATA
                // ----------------------------------

                socket.roomId =
                    roomId;

                socket.userName =
                    name || "Guest";

                socket.micOn =
                    micOn !== false;

                socket.cameraOn =
                    cameraOn !== false;

                // ----------------------------------
                // TELL NEW USER ABOUT EXISTING USERS
                // ----------------------------------

                existingUsers.forEach(
                    (userId) => {

                        if (
                            userId ===
                            socket.id
                        ) {
                            return;
                        }

                        const existingSocket =
                            io.sockets.sockets.get(
                                userId
                            );

                        socket.emit(
                            "user-already-in-room",
                            {
                                userId,
                                name:
                                    existingSocket
                                        ?.userName ||
                                    "Guest",
                                micOn:
                                    existingSocket
                                        ?.micOn !==
                                    false,
                                cameraOn:
                                    existingSocket
                                        ?.cameraOn !==
                                    false,
                            }
                        );
                    }
                );

                // ----------------------------------
                // JOIN ROOM
                // ----------------------------------

                socket.join(
                    roomId
                );

                console.log(
                    "Room:",
                    roomId
                );

                console.log(
                    "Members:",
                    [
                        ...(
                            io.sockets.adapter.rooms.get(
                                roomId
                            ) || []
                        ),
                    ]
                );

                // ----------------------------------
                // TELL EXISTING USERS
                // NEW USER JOINED
                // ----------------------------------

                socket
                    .to(roomId)
                    .emit(
                        "user-joined",
                        {
                            userId:
                                socket.id,
                            name:
                                socket.userName,
                            micOn:
                                socket.micOn,
                            cameraOn:
                                socket.cameraOn,
                        }
                    );
            }
        );

        // ======================================
        // OFFER
        // ======================================

        socket.on(
            "offer",
            ({
                offer,
                target,
            }) => {

                console.log(
                    "OFFER:",
                    socket.id,
                    "→",
                    target
                );

                io.to(
                    target
                ).emit(
                    "offer",
                    {
                        offer,
                        sender:
                            socket.id,
                    }
                );
            }
        );

        // ======================================
        // ANSWER
        // ======================================

        socket.on(
            "answer",
            ({
                answer,
                target,
            }) => {

                console.log(
                    "ANSWER:",
                    socket.id,
                    "→",
                    target
                );

                io.to(
                    target
                ).emit(
                    "answer",
                    {
                        answer,
                        sender:
                            socket.id,
                    }
                );
            }
        );

        // ======================================
        // ICE CANDIDATE
        // ======================================

        socket.on(
            "ice-candidate",
            ({
                candidate,
                target,
            }) => {

                io.to(
                    target
                ).emit(
                    "ice-candidate",
                    {
                        candidate,
                        sender:
                            socket.id,
                    }
                );
            }
        );

        // ======================================
        // MEDIA STATE
        // ======================================

        socket.on(
            "media-state",
            ({
                micOn,
                cameraOn,
            }) => {

                socket.micOn =
                    micOn;

                socket.cameraOn =
                    cameraOn;

                if (
                    !socket.roomId
                ) {
                    return;
                }

                socket
                    .to(
                        socket.roomId
                    )
                    .emit(
                        "participant-media-state",
                        {
                            userId:
                                socket.id,
                            micOn,
                            cameraOn,
                        }
                    );
            }
        );

        // ======================================
        // CHAT MESSAGE
        // ======================================

        socket.on(
            "chat-message",
            ({
                message,
            }) => {

                if (
                    !socket.roomId
                ) {
                    return;
                }

                const cleanMessage =
                    String(
                        message || ""
                    ).trim();

                if (
                    !cleanMessage
                ) {
                    return;
                }

                io.to(
                    socket.roomId
                ).emit(
                    "chat-message",
                    {
                        sender:
                            socket.id,
                        name:
                            socket.userName ||
                            "Guest",
                        message:
                            cleanMessage,
                        time:
                            new Date().toISOString(),
                    }
                );
            }
        );

        // ======================================
        // SCREEN SHARE STATE
        // ======================================

        socket.on(
            "screen-share-state",
            ({
                sharing,
            }) => {

                if (
                    !socket.roomId
                ) {
                    return;
                }

                socket
                    .to(
                        socket.roomId
                    )
                    .emit(
                        "participant-screen-share",
                        {
                            userId:
                                socket.id,
                            sharing:
                                Boolean(
                                    sharing
                                ),
                        }
                    );
            }
        );

        // ======================================
        // LEAVE ROOM
        // ======================================

        socket.on(
            "leave-room",
            () => {

                leaveRoom(
                    socket
                );
            }
        );

        // ======================================
        // DISCONNECT
        // ======================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "User disconnected:",
                    socket.id
                );

                leaveRoom(
                    socket
                );
            }
        );
    }
);

// ==========================================
// LEAVE ROOM FUNCTION
// ==========================================

function leaveRoom(socket) {

    const roomId =
        socket.roomId;

    if (!roomId) {
        return;
    }

    console.log(
        "User left room:",
        roomId
    );

    socket
        .to(roomId)
        .emit(
            "user-left",
            {
                userId:
                    socket.id,
            }
        );

    socket.leave(
        roomId
    );

    socket.roomId =
        null;

    // --------------------------------------
    // DELETE EMPTY MEETING
    // --------------------------------------

    setTimeout(() => {

        const room =
            io.sockets.adapter.rooms.get(
                roomId
            );

        if (
            !room ||
            room.size === 0
        ) {

            activeMeetings.delete(
                roomId
            );

            console.log(
                "Meeting deleted:",
                roomId
            );
        }

    }, 500);
}

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
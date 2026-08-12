import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import socket from "../../services/socket";

function MeetingRoom() {

    const {
        roomId,
    } = useParams();

    const navigate =
        useNavigate();

    // ==========================================
    // USER INFO
    // ==========================================

    const savedUser =
        sessionStorage.getItem(
            `meetflow-user-${roomId}`
        );

    const userInfo =
        savedUser
            ? JSON.parse(savedUser)
            : {};

    const userName =
        userInfo.name ||
        "Guest";

    // ==========================================
    // STATE
    // ==========================================

    const [micOn, setMicOn] =
        useState(
            userInfo.micOn !== false
        );

    const [cameraOn, setCameraOn] =
        useState(
            userInfo.cameraOn !== false
        );

    const [participantJoined, setParticipantJoined] =
        useState(false);

    const [remoteUserName, setRemoteUserName] =
        useState("Participant");

    const [remoteMicOn, setRemoteMicOn] =
        useState(true);

    const [remoteCameraOn, setRemoteCameraOn] =
        useState(true);

    const [screenSharing, setScreenSharing] =
        useState(false);

    const [remoteScreenSharing, setRemoteScreenSharing] =
        useState(false);

    const [chatOpen, setChatOpen] =
        useState(false);

    const [message, setMessage] =
        useState("");

    const [messages, setMessages] =
        useState([]);

    const [copied, setCopied] =
        useState(false);

    const [connectionStatus, setConnectionStatus] =
        useState("Connecting...");

    // ==========================================
    // REFS
    // ==========================================

    const videoRef =
        useRef(null);

    const remoteVideoRef =
        useRef(null);

    const peerConnection =
        useRef(null);

    const remoteUserId =
        useRef(null);

    const localStreamRef =
        useRef(null);

    const screenStreamRef =
        useRef(null);

    const handledUsers =
        useRef(new Set());

    const pendingIceCandidates =
        useRef([]);

    // ==========================================
    // CAMERA + MICROPHONE
    // ==========================================

    useEffect(() => {

        let mounted = true;

        const startMedia =
            async () => {

                try {

                    const mediaStream =
                        await navigator.mediaDevices.getUserMedia(
                            {
                                video: true,
                                audio: true,
                            }
                        );

                    if (
                        !mounted
                    ) {

                        mediaStream
                            .getTracks()
                            .forEach(
                                (track) =>
                                    track.stop()
                            );

                        return;
                    }

                    // ----------------------------------
                    // APPLY INITIAL MIC STATE
                    // ----------------------------------

                    mediaStream
                        .getAudioTracks()
                        .forEach(
                            (track) => {

                                track.enabled =
                                    userInfo.micOn !==
                                    false;
                            }
                        );

                    // ----------------------------------
                    // APPLY INITIAL CAMERA STATE
                    // ----------------------------------

                    mediaStream
                        .getVideoTracks()
                        .forEach(
                            (track) => {

                                track.enabled =
                                    userInfo.cameraOn !==
                                    false;
                            }
                        );

                    localStreamRef.current =
                        mediaStream;

                    if (
                        videoRef.current
                    ) {

                        videoRef.current.srcObject =
                            mediaStream;
                    }

                    setConnectionStatus(
                        "Ready"
                    );

                    console.log(
                        "Camera and microphone started"
                    );

                } catch (error) {

                    console.error(
                        "Media permission error:",
                        error
                    );

                    setConnectionStatus(
                        "Camera unavailable"
                    );
                }
            };

        startMedia();

        return () => {

            mounted = false;

            if (
                screenStreamRef.current
            ) {

                screenStreamRef.current
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

                screenStreamRef.current =
                    null;
            }

            if (
                localStreamRef.current
            ) {

                localStreamRef.current
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

                localStreamRef.current =
                    null;
            }
        };

    }, [roomId]);

    // ==========================================
    // CREATE PEER CONNECTION
    // ==========================================

    const createPeerConnection =
        () => {

            if (
                peerConnection.current
            ) {

                return peerConnection.current;
            }

            const peer =
                new RTCPeerConnection(
                    {
                        iceServers: [
                            {
                                urls:
                                    "stun:stun.l.google.com:19302",
                            },
                        ],
                    }
                );

            // --------------------------------------
            // ADD LOCAL TRACKS
            // --------------------------------------

            const localStream =
                localStreamRef.current;

            if (
                localStream
            ) {

                localStream
                    .getTracks()
                    .forEach(
                        (track) => {

                            peer.addTrack(
                                track,
                                localStream
                            );
                        }
                    );
            }

            // --------------------------------------
            // REMOTE TRACK
            // --------------------------------------

            peer.ontrack =
                (event) => {

                    console.log(
                        "Remote stream received"
                    );

                    if (
                        remoteVideoRef.current &&
                        event.streams[0]
                    ) {

                        remoteVideoRef.current.srcObject =
                            event.streams[0];

                        remoteVideoRef.current
                            .play()
                            .catch(
                                () => {}
                            );
                    }
                };

            // --------------------------------------
            // CONNECTION STATE
            // --------------------------------------

            peer.onconnectionstatechange =
                () => {

                    console.log(
                        "WebRTC connection state:",
                        peer.connectionState
                    );

                    if (
                        peer.connectionState ===
                        "connected"
                    ) {

                        setConnectionStatus(
                            "Connected"
                        );
                    }

                    if (
                        peer.connectionState ===
                            "failed" ||
                        peer.connectionState ===
                            "closed"
                    ) {

                        setConnectionStatus(
                            "Disconnected"
                        );

                        setParticipantJoined(
                            false
                        );
                    }
                };

            // --------------------------------------
            // ICE STATE
            // --------------------------------------

            peer.oniceconnectionstatechange =
                () => {

                    console.log(
                        "ICE state:",
                        peer.iceConnectionState
                    );
                };

            // --------------------------------------
            // ICE CANDIDATE
            // --------------------------------------

            peer.onicecandidate =
                (event) => {

                    if (
                        !event.candidate
                    ) {
                        return;
                    }

                    const target =
                        remoteUserId.current;

                    if (
                        !target
                    ) {
                        return;
                    }

                    socket.emit(
                        "ice-candidate",
                        {
                            candidate:
                                event.candidate,
                            target,
                        }
                    );
                };

            peerConnection.current =
                peer;

            console.log(
                "WebRTC peer connection created"
            );

            return peer;
        };

    // ==========================================
    // CREATE OFFER
    // ==========================================

    const createOffer =
        async (
            userId
        ) => {

            try {

                remoteUserId.current =
                    userId;

                if (
                    handledUsers.current.has(
                        userId
                    )
                ) {

                    return;
                }

                handledUsers.current.add(
                    userId
                );

                const peer =
                    createPeerConnection();

                if (
                    peer.signalingState !==
                    "stable"
                ) {

                    return;
                }

                const offer =
                    await peer.createOffer();

                await peer.setLocalDescription(
                    offer
                );

                socket.emit(
                    "offer",
                    {
                        offer,
                        target:
                            userId,
                    }
                );

                console.log(
                    "Offer sent to:",
                    userId
                );

            } catch (error) {

                console.error(
                    "Offer error:",
                    error
                );

                handledUsers.current.delete(
                    userId
                );
            }
        };

    // ==========================================
    // SOCKET EVENTS
    // ==========================================

    useEffect(() => {

        if (
            !localStreamRef.current
        ) {
            return;
        }

        let joined =
            false;

        // --------------------------------------
        // JOIN ROOM
        // --------------------------------------

        const joinRoom =
            () => {

                if (
                    joined
                ) {
                    return;
                }

                joined = true;

                console.log(
                    "Joining room:",
                    roomId
                );

                socket.emit(
                    "join-room",
                    {
                        roomId,
                        name:
                            userName,
                        micOn,
                        cameraOn,
                    }
                );
            };

        // --------------------------------------
        // EXISTING USER
        // --------------------------------------

        const handleExistingUser =
            ({
                userId,
                name,
                micOn:
                    existingMicOn,
                cameraOn:
                    existingCameraOn,
            }) => {

                console.log(
                    "Existing participant:",
                    userId
                );

                remoteUserId.current =
                    userId;

                setRemoteUserName(
                    name ||
                    "Participant"
                );

                setRemoteMicOn(
                    existingMicOn !==
                    false
                );

                setRemoteCameraOn(
                    existingCameraOn !==
                    false
                );

                setParticipantJoined(
                    true
                );

                createPeerConnection();
            };

        // --------------------------------------
        // NEW USER
        // --------------------------------------

        const handleUserJoined =
            ({
                userId,
                name,
                micOn:
                    newMicOn,
                cameraOn:
                    newCameraOn,
            }) => {

                console.log(
                    "New participant:",
                    userId
                );

                remoteUserId.current =
                    userId;

                setRemoteUserName(
                    name ||
                    "Participant"
                );

                setRemoteMicOn(
                    newMicOn !==
                    false
                );

                setRemoteCameraOn(
                    newCameraOn !==
                    false
                );

                setParticipantJoined(
                    true
                );

                createOffer(
                    userId
                );
            };

        // --------------------------------------
        // OFFER
        // --------------------------------------

        const handleOffer =
            async ({
                offer,
                sender,
            }) => {

                console.log(
                    "Offer received from:",
                    sender
                );

                try {

                    remoteUserId.current =
                        sender;

                    setParticipantJoined(
                        true
                    );

                    const peer =
                        createPeerConnection();

                    if (
                        peer.signalingState !==
                        "stable"
                    ) {

                        console.log(
                            "Peer not stable:",
                            peer.signalingState
                        );

                        return;
                    }

                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            offer
                        )
                    );

                    // --------------------------------
                    // ADD BUFFERED ICE
                    // --------------------------------

                    const candidates =
                        pendingIceCandidates.current;

                    pendingIceCandidates.current =
                        [];

                    for (
                        const candidate of candidates
                    ) {

                        try {

                            await peer.addIceCandidate(
                                candidate
                            );

                        } catch (
                            error
                        ) {

                            console.error(
                                "Buffered ICE error:",
                                error
                            );
                        }
                    }

                    const answer =
                        await peer.createAnswer();

                    await peer.setLocalDescription(
                        answer
                    );

                    socket.emit(
                        "answer",
                        {
                            answer,
                            target:
                                sender,
                        }
                    );

                    console.log(
                        "Answer sent to:",
                        sender
                    );

                } catch (error) {

                    console.error(
                        "Offer handling error:",
                        error
                    );
                }
            };

        // --------------------------------------
        // ANSWER
        // --------------------------------------

        const handleAnswer =
            async ({
                answer,
                sender,
            }) => {

                try {

                    remoteUserId.current =
                        sender;

                    const peer =
                        peerConnection.current;

                    if (
                        !peer
                    ) {
                        return;
                    }

                    if (
                        peer.signalingState !==
                        "have-local-offer"
                    ) {

                        console.log(
                            "Ignoring answer. State:",
                            peer.signalingState
                        );

                        return;
                    }

                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            answer
                        )
                    );

                    // --------------------------------
                    // ADD BUFFERED ICE
                    // --------------------------------

                    const candidates =
                        pendingIceCandidates.current;

                    pendingIceCandidates.current =
                        [];

                    for (
                        const candidate of candidates
                    ) {

                        try {

                            await peer.addIceCandidate(
                                candidate
                            );

                        } catch (
                            error
                        ) {

                            console.error(
                                "Buffered ICE error:",
                                error
                            );
                        }
                    }

                    console.log(
                        "Remote answer applied"
                    );

                } catch (error) {

                    console.error(
                        "Answer handling error:",
                        error
                    );
                }
            };

        // --------------------------------------
        // ICE
        // --------------------------------------

        const handleIceCandidate =
            async ({
                candidate,
                sender,
            }) => {

                try {

                    if (
                        sender !==
                        remoteUserId.current
                    ) {

                        return;
                    }

                    const peer =
                        peerConnection.current;

                    if (
                        !peer
                    ) {
                        return;
                    }

                    const iceCandidate =
                        new RTCIceCandidate(
                            candidate
                        );

                    if (
                        !peer.remoteDescription
                    ) {

                        pendingIceCandidates.current.push(
                            iceCandidate
                        );

                        return;
                    }

                    await peer.addIceCandidate(
                        iceCandidate
                    );

                } catch (error) {

                    console.error(
                        "ICE candidate error:",
                        error
                    );
                }
            };

        // --------------------------------------
        // MEDIA STATE
        // --------------------------------------

        const handleParticipantMedia =
            ({
                userId,
                micOn:
                    participantMic,
                cameraOn:
                    participantCamera,
            }) => {

                if (
                    userId !==
                    remoteUserId.current
                ) {
                    return;
                }

                setRemoteMicOn(
                    participantMic !==
                    false
                );

                setRemoteCameraOn(
                    participantCamera !==
                    false
                );
            };

        // --------------------------------------
        // SCREEN SHARE STATE
        // --------------------------------------

        const handleParticipantScreenShare =
            ({
                userId,
                sharing,
            }) => {

                if (
                    userId !==
                    remoteUserId.current
                ) {
                    return;
                }

                setRemoteScreenSharing(
                    Boolean(
                        sharing
                    )
                );
            };

        // --------------------------------------
        // CHAT
        // --------------------------------------

        const handleChatMessage =
            (chatMessage) => {

                setMessages(
                    (previous) => [
                        ...previous,
                        chatMessage,
                    ]
                );
            };

        // --------------------------------------
        // USER LEFT
        // --------------------------------------

        const handleUserLeft =
            ({
                userId,
            }) => {

                console.log(
                    "Participant left:",
                    userId
                );

                if (
                    remoteUserId.current ===
                    userId
                ) {

                    remoteUserId.current =
                        null;

                    handledUsers.current.delete(
                        userId
                    );

                    if (
                        peerConnection.current
                    ) {

                        peerConnection.current.close();

                        peerConnection.current =
                            null;
                    }

                    if (
                        remoteVideoRef.current
                    ) {

                        remoteVideoRef.current.srcObject =
                            null;
                    }

                    setParticipantJoined(
                        false
                    );

                    setRemoteUserName(
                        "Participant"
                    );

                    setRemoteMicOn(
                        true
                    );

                    setRemoteCameraOn(
                        true
                    );

                    setRemoteScreenSharing(
                        false
                    );

                    setConnectionStatus(
                        "Waiting for participant..."
                    );
                }
            };

        // --------------------------------------
        // INVALID MEETING
        // --------------------------------------

        const handleMeetingInvalid =
            () => {

                navigate("/");
            };

        // --------------------------------------
        // REGISTER EVENTS
        // --------------------------------------

        socket.on(
            "user-already-in-room",
            handleExistingUser
        );

        socket.on(
            "user-joined",
            handleUserJoined
        );

        socket.on(
            "offer",
            handleOffer
        );

        socket.on(
            "answer",
            handleAnswer
        );

        socket.on(
            "ice-candidate",
            handleIceCandidate
        );

        socket.on(
            "participant-media-state",
            handleParticipantMedia
        );

        socket.on(
            "participant-screen-share",
            handleParticipantScreenShare
        );

        socket.on(
            "chat-message",
            handleChatMessage
        );

        socket.on(
            "user-left",
            handleUserLeft
        );

        socket.on(
            "meeting-invalid",
            handleMeetingInvalid
        );

        // --------------------------------------
        // CONNECT
        // --------------------------------------

        if (
            socket.connected
        ) {

            joinRoom();

        } else {

            socket.on(
                "connect",
                joinRoom
            );
        }

        // --------------------------------------
        // CLEANUP
        // --------------------------------------

        return () => {

            socket.off(
                "connect",
                joinRoom
            );

            socket.off(
                "user-already-in-room",
                handleExistingUser
            );

            socket.off(
                "user-joined",
                handleUserJoined
            );

            socket.off(
                "offer",
                handleOffer
            );

            socket.off(
                "answer",
                handleAnswer
            );

            socket.off(
                "ice-candidate",
                handleIceCandidate
            );

            socket.off(
                "participant-media-state",
                handleParticipantMedia
            );

            socket.off(
                "participant-screen-share",
                handleParticipantScreenShare
            );

            socket.off(
                "chat-message",
                handleChatMessage
            );

            socket.off(
                "user-left",
                handleUserLeft
            );

            socket.off(
                "meeting-invalid",
                handleMeetingInvalid
            );
        };

    }, [
        roomId,
        userName,
        micOn,
        cameraOn,
        navigate,
        localStreamRef.current,
    ]);

    // ==========================================
    // TOGGLE MIC
    // ==========================================

    const toggleMic =
        () => {

            const stream =
                localStreamRef.current;

            if (
                !stream
            ) {
                return;
            }

            const newState =
                !micOn;

            stream
                .getAudioTracks()
                .forEach(
                    (track) => {
                        track.enabled =
                            newState;
                    }
                );

            setMicOn(
                newState
            );

            socket.emit(
                "media-state",
                {
                    micOn:
                        newState,
                    cameraOn,
                }
            );
        };

    // ==========================================
    // TOGGLE CAMERA
    // ==========================================

    const toggleCamera =
        () => {

            const stream =
                localStreamRef.current;

            if (
                !stream
            ) {
                return;
            }

            const newState =
                !cameraOn;

            stream
                .getVideoTracks()
                .forEach(
                    (track) => {
                        track.enabled =
                            newState;
                    }
                );

            setCameraOn(
                newState
            );

            socket.emit(
                "media-state",
                {
                    micOn,
                    cameraOn:
                        newState,
                }
            );
        };

    // ==========================================
    // START SCREEN SHARE
    // ==========================================

    const startScreenShare =
        async () => {

            try {

                const screenStream =
                    await navigator.mediaDevices.getDisplayMedia(
                        {
                            video: true,
                            audio: false,
                        }
                    );

                const screenTrack =
                    screenStream.getVideoTracks()[0];

                if (
                    !screenTrack
                ) {
                    return;
                }

                screenStreamRef.current =
                    screenStream;

                // ----------------------------------
                // SHOW SCREEN LOCALLY
                // ----------------------------------

                if (
                    videoRef.current
                ) {

                    videoRef.current.srcObject =
                        screenStream;
                }

                // ----------------------------------
                // REPLACE WEBRTC VIDEO TRACK
                // ----------------------------------

                const peer =
                    peerConnection.current;

                if (
                    peer
                ) {

                    const sender =
                        peer
                            .getSenders()
                            .find(
                                (item) =>
                                    item.track
                                        ?.kind ===
                                    "video"
                            );

                    if (
                        sender
                    ) {

                        await sender.replaceTrack(
                            screenTrack
                        );
                    }
                }

                setScreenSharing(
                    true
                );

                socket.emit(
                    "screen-share-state",
                    {
                        sharing:
                            true,
                    }
                );

                // ----------------------------------
                // USER STOPS FROM BROWSER UI
                // ----------------------------------

                screenTrack.onended =
                    () => {

                        stopScreenShare();
                    };

            } catch (error) {

                console.error(
                    "Screen share error:",
                    error
                );
            }
        };

    // ==========================================
    // STOP SCREEN SHARE
    // ==========================================

    const stopScreenShare =
        async () => {

            try {

                const screenStream =
                    screenStreamRef.current;

                if (
                    screenStream
                ) {

                    screenStream
                        .getTracks()
                        .forEach(
                            (track) =>
                                track.stop()
                        );

                    screenStreamRef.current =
                        null;
                }

                const cameraTrack =
                    localStreamRef.current
                        ?.getVideoTracks()[0];

                const peer =
                    peerConnection.current;

                if (
                    peer &&
                    cameraTrack
                ) {

                    const sender =
                        peer
                            .getSenders()
                            .find(
                                (item) =>
                                    item.track
                                        ?.kind ===
                                    "video"
                            );

                    if (
                        sender
                    ) {

                        await sender.replaceTrack(
                            cameraTrack
                        );
                    }
                }

                // ----------------------------------
                // SHOW CAMERA AGAIN
                // ----------------------------------

                if (
                    videoRef.current &&
                    localStreamRef.current
                ) {

                    videoRef.current.srcObject =
                        localStreamRef.current;
                }

                setScreenSharing(
                    false
                );

                socket.emit(
                    "screen-share-state",
                    {
                        sharing:
                            false,
                    }
                );

            } catch (error) {

                console.error(
                    "Stop screen share error:",
                    error
                );
            }
        };

    // ==========================================
    // COPY LINK
    // ==========================================

    const copyMeetingLink =
        async () => {

            try {

                await navigator.clipboard.writeText(
                    window.location.href
                );

                setCopied(
                    true
                );

                setTimeout(
                    () => {
                        setCopied(
                            false
                        );
                    },
                    2000
                );

            } catch (error) {

                console.error(
                    "Copy failed:",
                    error
                );
            }
        };

    // ==========================================
    // SEND CHAT
    // ==========================================

    const sendMessage =
        () => {

            const cleanMessage =
                message.trim();

            if (
                !cleanMessage
            ) {
                return;
            }

            socket.emit(
                "chat-message",
                {
                    message:
                        cleanMessage,
                }
            );

            setMessage("");
        };

    // ==========================================
    // LEAVE MEETING
    // ==========================================

    const leaveMeeting =
        () => {

            // ----------------------------------
            // SCREEN SHARE
            // ----------------------------------

            if (
                screenStreamRef.current
            ) {

                screenStreamRef.current
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

                screenStreamRef.current =
                    null;
            }

            // ----------------------------------
            // STOP LOCAL MEDIA
            // ----------------------------------

            if (
                localStreamRef.current
            ) {

                localStreamRef.current
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

                localStreamRef.current =
                    null;
            }

            // ----------------------------------
            // CLOSE PEER
            // ----------------------------------

            if (
                peerConnection.current
            ) {

                peerConnection.current.close();

                peerConnection.current =
                    null;
            }

            // ----------------------------------
            // CLEAR VIDEO
            // ----------------------------------

            if (
                videoRef.current
            ) {

                videoRef.current.srcObject =
                    null;
            }

            if (
                remoteVideoRef.current
            ) {

                remoteVideoRef.current.srcObject =
                    null;
            }

            // ----------------------------------
            // TELL SERVER
            // ----------------------------------

            socket.emit(
                "leave-room"
            );

            // ----------------------------------
            // CLEAR USER DATA
            // ----------------------------------

            sessionStorage.removeItem(
                `meetflow-user-${roomId}`
            );

            navigate("/");
        };

    // ==========================================
    // AVATAR LETTER
    // ==========================================

    const remoteInitial =
        remoteUserName
            ? remoteUserName
                .charAt(0)
                .toUpperCase()
            : "?";

    const localInitial =
        userName
            .charAt(0)
            .toUpperCase();

    // ==========================================
    // UI
    // ==========================================

    return (

        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">

            {/* ================================= */}
            {/* HEADER */}
            {/* ================================= */}

            <header className="h-16 bg-white border-b border-slate-200 px-5 md:px-7 flex items-center justify-between shrink-0">

                <div className="flex items-center gap-3">

                    <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                        🎥
                    </div>

                    <div>

                        <h1 className="font-bold">
                            MeetFlow
                        </h1>

                        <p className="text-xs text-slate-400">
                            Room: {roomId}
                        </p>

                    </div>

                </div>

                {/* HEADER RIGHT */}

                <div className="flex items-center gap-3">

                    <span className="hidden md:block text-xs text-slate-400">
                        {connectionStatus}
                    </span>

                    <button
                        onClick={
                            copyMeetingLink
                        }
                        className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 font-medium text-sm transition"
                    >

                        {copied
                            ? "✓ Copied"
                            : "🔗 Copy link"}

                    </button>

                </div>

            </header>

            {/* ================================= */}
            {/* MEETING CONTENT */}
            {/* ================================= */}

            <main className="flex-1 p-4 md:p-6 overflow-hidden">

                <div
                    className={`h-full ${
                        chatOpen
                            ? "grid lg:grid-cols-[1fr_330px] gap-4"
                            : ""
                    }`}
                >

                    {/* VIDEO AREA */}

                    <div className="h-full">

                        <div className="grid md:grid-cols-2 gap-4 h-full">

                            {/* ========================= */}
                            {/* LOCAL VIDEO */}
                            {/* ========================= */}

                            <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[300px] shadow-lg">

                                {cameraOn ||
                                screenSharing ? (

                                    <video
                                        ref={
                                            videoRef
                                        }
                                        autoPlay
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />

                                ) : (

                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800">

                                        <div className="w-28 h-28 rounded-full bg-blue-600 text-white flex items-center justify-center text-5xl font-bold">

                                            {
                                                localInitial
                                            }

                                        </div>

                                        <p className="text-white mt-5 font-medium">
                                            Camera is off
                                        </p>

                                    </div>
                                )}

                                {/* NAME */}

                                <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm">

                                    You ·{" "}
                                    {userName}

                                </div>

                                {/* MIC STATUS */}

                                {!micOn && (

                                    <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center">
                                        🔇
                                    </div>

                                )}

                                {/* SCREEN SHARE */}

                                {screenSharing && (

                                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">
                                        You are sharing
                                    </div>

                                )}

                            </div>

                            {/* ========================= */}
                            {/* REMOTE VIDEO */}
                            {/* ========================= */}

                            <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[300px] shadow-lg">

                                {!participantJoined ? (

                                    <div className="w-full h-full flex flex-col items-center justify-center bg-white border border-slate-200">

                                        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-3xl">
                                            👤
                                        </div>

                                        <p className="mt-4 font-semibold text-slate-700">
                                            Waiting for participant
                                        </p>

                                        <p className="text-sm text-slate-400 mt-1">
                                            Share the meeting link to invite someone
                                        </p>

                                    </div>

                                ) : remoteCameraOn ? (

                                    <video
                                        ref={
                                            remoteVideoRef
                                        }
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover bg-slate-900"
                                    />

                                ) : (

                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800">

                                        <div className="w-28 h-28 rounded-full bg-blue-600 text-white flex items-center justify-center text-5xl font-bold">

                                            {
                                                remoteInitial
                                            }

                                        </div>

                                        <p className="text-white mt-5 font-medium text-lg">
                                            {
                                                remoteUserName
                                            }
                                        </p>

                                        <p className="text-slate-400 text-sm mt-1">
                                            Camera is off
                                        </p>

                                    </div>
                                )}

                                {/* REMOTE NAME */}

                                {participantJoined && (

                                    <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm">

                                        {
                                            remoteUserName
                                        }

                                    </div>

                                )}

                                {/* REMOTE MIC */}

                                {participantJoined &&
                                    !remoteMicOn && (

                                        <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center">
                                            🔇
                                        </div>

                                    )}

                                {/* REMOTE SCREEN */}

                                {remoteScreenSharing && (

                                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">
                                        {remoteUserName} is sharing
                                    </div>

                                )}

                            </div>

                        </div>

                    </div>

                    {/* ================================= */}
                    {/* CHAT */}
                    {/* ================================= */}

                    {chatOpen && (

                        <aside className="bg-white border border-slate-200 rounded-2xl shadow-lg flex flex-col overflow-hidden">

                            {/* CHAT HEADER */}

                            <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between">

                                <h3 className="font-semibold">
                                    Chat
                                </h3>

                                <button
                                    onClick={() =>
                                        setChatOpen(
                                            false
                                        )
                                    }
                                    className="text-slate-400 hover:text-slate-700 text-xl"
                                >
                                    ×
                                </button>

                            </div>

                            {/* MESSAGES */}

                            <div className="flex-1 p-4 overflow-y-auto space-y-3">

                                {messages.length ===
                                0 ? (

                                    <div className="h-full flex flex-col items-center justify-center text-center">

                                        <div className="text-3xl">
                                            💬
                                        </div>

                                        <p className="mt-3 text-sm font-medium text-slate-600">
                                            No messages yet
                                        </p>

                                        <p className="text-xs text-slate-400 mt-1">
                                            Start the conversation
                                        </p>

                                    </div>

                                ) : (

                                    messages.map(
                                        (
                                            item,
                                            index
                                        ) => (

                                            <div
                                                key={
                                                    index
                                                }
                                                className={`${
                                                    item.sender ===
                                                    socket.id
                                                        ? "ml-8"
                                                        : "mr-8"
                                                }`}
                                            >

                                                <p className="text-xs text-slate-400 mb-1">
                                                    {
                                                        item.name
                                                    }
                                                </p>

                                                <div className="px-3 py-2 rounded-xl bg-slate-100 text-sm text-slate-700 break-words">
                                                    {
                                                        item.message
                                                    }
                                                </div>

                                            </div>

                                        )
                                    )
                                )}

                            </div>

                            {/* CHAT INPUT */}

                            <div className="p-3 border-t border-slate-200">

                                <div className="flex gap-2">

                                    <input
                                        value={
                                            message
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            setMessage(
                                                e.target.value
                                            )
                                        }
                                        onKeyDown={(
                                            e
                                        ) => {

                                            if (
                                                e.key ===
                                                    "Enter" &&
                                                !e.shiftKey
                                            ) {

                                                e.preventDefault();

                                                sendMessage();
                                            }

                                        }}
                                        placeholder="Type a message..."
                                        className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />

                                    <button
                                        onClick={
                                            sendMessage
                                        }
                                        className="px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        ➤
                                    </button>

                                </div>

                            </div>

                        </aside>

                    )}

                </div>

            </main>

            {/* ================================= */}
            {/* CONTROLS */}
            {/* ================================= */}

            <footer className="h-20 bg-white border-t border-slate-200 flex items-center justify-center gap-2 md:gap-3 px-4 shrink-0">

                {/* MIC */}

                <button
                    onClick={
                        toggleMic
                    }
                    title={
                        micOn
                            ? "Mute microphone"
                            : "Unmute microphone"
                    }
                    className={`w-12 h-12 rounded-full flex items-center justify-center border transition ${
                        micOn
                            ? "bg-slate-100 border-slate-200 hover:bg-slate-200"
                            : "bg-red-50 border-red-200 text-red-600"
                    }`}
                >

                    {micOn
                        ? "🎤"
                        : "🔇"}

                </button>

                {/* CAMERA */}

                <button
                    onClick={
                        toggleCamera
                    }
                    title={
                        cameraOn
                            ? "Turn camera off"
                            : "Turn camera on"
                    }
                    className={`w-12 h-12 rounded-full flex items-center justify-center border transition ${
                        cameraOn
                            ? "bg-slate-100 border-slate-200 hover:bg-slate-200"
                            : "bg-red-50 border-red-200 text-red-600"
                    }`}
                >

                    {cameraOn
                        ? "📷"
                        : "🚫"}

                </button>

                {/* SCREEN SHARE */}

                <button
                    onClick={
                        screenSharing
                            ? stopScreenShare
                            : startScreenShare
                    }
                    title={
                        screenSharing
                            ? "Stop sharing"
                            : "Share screen"
                    }
                    className={`h-12 px-4 rounded-full border font-medium text-sm transition ${
                        screenSharing
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                    }`}
                >

                    🖥️{" "}
                    <span className="hidden md:inline">
                        {screenSharing
                            ? "Stop sharing"
                            : "Share screen"}
                    </span>

                </button>

                {/* CHAT */}

                <button
                    onClick={() =>
                        setChatOpen(
                            (previous) =>
                                !previous
                        )
                    }
                    title="Chat"
                    className={`h-12 px-4 rounded-full border font-medium text-sm transition ${
                        chatOpen
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                    }`}
                >

                    💬{" "}
                    <span className="hidden md:inline">
                        Chat
                    </span>

                </button>

                {/* LEAVE */}

                <button
                    onClick={
                        leaveMeeting
                    }
                    className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold ml-2 transition"
                >
                    Leave
                </button>

            </footer>

        </div>
    );
}

export default MeetingRoom;
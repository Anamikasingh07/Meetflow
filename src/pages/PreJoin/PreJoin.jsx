import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

function PreJoin() {

    const {
        roomId,
    } = useParams();

    const navigate =
        useNavigate();

    const videoRef =
        useRef(null);

    const streamRef =
        useRef(null);

    const [name, setName] =
        useState("");

    const [micOn, setMicOn] =
        useState(true);

    const [cameraOn, setCameraOn] =
        useState(true);

    const [meetingValid, setMeetingValid] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    // ==========================================
    // CHECK MEETING
    // ==========================================

    useEffect(() => {

        let cancelled = false;

        const checkMeeting =
            async () => {

                try {

                    const response =
                        await fetch(
                            `http://localhost:5000/api/meetings/${roomId}`
                        );

                    const data =
                        await response.json();

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    setMeetingValid(
                        data.exists
                    );

                    if (
                        !data.exists
                    ) {

                        setError(
                            "This meeting doesn't exist or has already ended."
                        );
                    }

                } catch (error) {

                    console.error(
                        error
                    );

                    if (
                        !cancelled
                    ) {

                        setMeetingValid(
                            false
                        );

                        setError(
                            "Unable to connect to MeetFlow server."
                        );
                    }

                } finally {

                    if (
                        !cancelled
                    ) {

                        setLoading(
                            false
                        );
                    }
                }
            };

        checkMeeting();

        return () => {
            cancelled = true;
        };

    }, [roomId]);

    // ==========================================
    // START CAMERA
    // ==========================================

    useEffect(() => {

        if (
            meetingValid !== true
        ) {
            return;
        }

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

                    streamRef.current =
                        mediaStream;

                    if (
                        videoRef.current
                    ) {

                        videoRef.current.srcObject =
                            mediaStream;
                    }

                } catch (error) {

                    console.error(
                        "Media error:",
                        error
                    );

                    if (
                        mounted
                    ) {

                        setError(
                            "Please allow camera and microphone access."
                        );
                    }
                }
            };

        startMedia();

        return () => {

            mounted = false;

            if (
                streamRef.current
            ) {

                streamRef.current
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

                streamRef.current =
                    null;
            }
        };

    }, [meetingValid]);

    // ==========================================
    // MIC
    // ==========================================

    const toggleMic =
        () => {

            if (
                !streamRef.current
            ) {
                return;
            }

            const tracks =
                streamRef.current
                    .getAudioTracks();

            tracks.forEach(
                (track) => {
                    track.enabled =
                        !track.enabled;
                }
            );

            setMicOn(
                (previous) =>
                    !previous
            );
        };

    // ==========================================
    // CAMERA
    // ==========================================

    const toggleCamera =
        () => {

            if (
                !streamRef.current
            ) {
                return;
            }

            const tracks =
                streamRef.current
                    .getVideoTracks();

            tracks.forEach(
                (track) => {
                    track.enabled =
                        !track.enabled;
                }
            );

            setCameraOn(
                (previous) =>
                    !previous
            );
        };

    // ==========================================
    // JOIN
    // ==========================================

    const joinMeeting =
        () => {

            setError("");

            if (
                !name.trim()
            ) {

                setError(
                    "Please enter your name."
                );

                return;
            }

            if (
                !streamRef.current
            ) {

                setError(
                    "Camera and microphone are not ready yet."
                );

                return;
            }

            // Save initial state in session storage.
            // We DO NOT send MediaStream through router state.
            sessionStorage.setItem(
                `meetflow-user-${roomId}`,
                JSON.stringify({
                    name:
                        name.trim(),
                    micOn,
                    cameraOn,
                })
            );

            navigate(
                `/meeting/${roomId}`
            );
        };

    // ==========================================
    // LOADING
    // ==========================================

    if (
        loading
    ) {

        return (

            <div className="min-h-screen bg-slate-50 flex items-center justify-center">

                <div className="text-center">

                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto" />

                    <p className="mt-4 text-slate-500">
                        Checking meeting...
                    </p>

                </div>

            </div>
        );
    }

    // ==========================================
    // INVALID MEETING
    // ==========================================

    if (
        meetingValid === false
    ) {

        return (

            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">

                <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-8 text-center">

                    <div className="w-16 h-16 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center text-3xl font-bold">
                        !
                    </div>

                    <h2 className="mt-6 text-2xl font-bold text-slate-900">
                        Meeting not found
                    </h2>

                    <p className="mt-3 text-slate-500 leading-relaxed">
                        The meeting ID you entered is invalid,
                        or the meeting has already ended.
                    </p>

                    <button
                        onClick={() =>
                            navigate("/")
                        }
                        className="w-full mt-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                        Create a new meeting
                    </button>

                </div>

            </div>
        );
    }

    // ==========================================
    // PREJOIN UI
    // ==========================================

    return (

        <div className="min-h-screen bg-slate-50">

            {/* HEADER */}

            <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">

                <div className="flex items-center gap-3">

                    <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                        🎥
                    </div>

                    <span className="font-bold text-slate-900">
                        MeetFlow
                    </span>

                </div>

                <div className="text-sm text-slate-500">

                    Meeting ID:
                    <span className="font-semibold text-slate-700 ml-1">
                        {roomId}
                    </span>

                </div>

            </header>

            {/* MAIN */}

            <main className="max-w-6xl mx-auto px-6 py-12">

                <div className="grid lg:grid-cols-[1.5fr_1fr] gap-12 items-center">

                    {/* PREVIEW */}

                    <div>

                        <div className="aspect-video rounded-3xl overflow-hidden bg-slate-900 shadow-2xl relative">

                            {cameraOn ? (

                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover"
                                />

                            ) : (

                                <div className="w-full h-full flex items-center justify-center">

                                    <div className="text-center">

                                        <div className="w-28 h-28 rounded-full bg-blue-600 text-white flex items-center justify-center text-5xl font-bold mx-auto">

                                            {name
                                                ? name
                                                    .charAt(
                                                        0
                                                    )
                                                    .toUpperCase()
                                                : "?"}

                                        </div>

                                        <p className="mt-5 text-white text-lg font-medium">
                                            Camera is off
                                        </p>

                                    </div>

                                </div>
                            )}

                            {/* NAME */}

                            <div className="absolute bottom-5 left-5 bg-black/60 text-white px-4 py-2 rounded-xl text-sm backdrop-blur-sm">

                                {name ||
                                    "You"}

                            </div>

                        </div>

                        {/* PREVIEW CONTROLS */}

                        <div className="flex justify-center gap-3 mt-5">

                            <button
                                onClick={
                                    toggleMic
                                }
                                className={`px-5 py-3 rounded-xl border font-medium transition ${
                                    micOn
                                        ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                        : "bg-red-50 border-red-200 text-red-600"
                                }`}
                            >

                                {micOn
                                    ? "🎤 Mic"
                                    : "🔇 Mic Off"}

                            </button>

                            <button
                                onClick={
                                    toggleCamera
                                }
                                className={`px-5 py-3 rounded-xl border font-medium transition ${
                                    cameraOn
                                        ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                        : "bg-red-50 border-red-200 text-red-600"
                                }`}
                            >

                                {cameraOn
                                    ? "📷 Camera"
                                    : "🚫 Camera Off"}

                            </button>

                        </div>

                    </div>

                    {/* JOIN FORM */}

                    <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8">

                        <h2 className="text-3xl font-bold text-slate-900">
                            What's your name?
                        </h2>

                        <p className="mt-2 text-slate-500">
                            Other participants will see this name.
                        </p>

                        <label className="block mt-8 text-sm font-semibold text-slate-700">
                            Your name
                        </label>

                        <input
                            value={name}
                            onChange={(e) =>
                                setName(
                                    e.target.value
                                )
                            }
                            onKeyDown={(e) => {

                                if (
                                    e.key ===
                                    "Enter"
                                ) {
                                    joinMeeting();
                                }

                            }}
                            maxLength={60}
                            placeholder="Enter your name"
                            className="w-full mt-2 px-4 py-3.5 rounded-xl border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="text-right text-xs text-slate-400 mt-1">
                            {name.length}/60
                        </div>

                        {error && (

                            <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                                {error}
                            </div>

                        )}

                        <button
                            onClick={
                                joinMeeting
                            }
                            className="w-full mt-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-100 transition"
                        >
                            Join meeting
                        </button>

                        <button
                            onClick={() =>
                                navigate("/")
                            }
                            className="w-full mt-3 py-3 rounded-xl text-slate-500 hover:bg-slate-50 font-medium"
                        >
                            Cancel
                        </button>

                    </div>

                </div>

            </main>

        </div>
    );
}

export default PreJoin;
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {

    const navigate =
        useNavigate();

    const [meetingId, setMeetingId] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    // ======================================
    // CREATE MEETING
    // ======================================

    const createMeeting =
        async () => {

            try {

                setLoading(true);
                setError("");

                const response =
                    await fetch(
                        "http://localhost:5000/api/meetings/create",
                        {
                            method: "POST",
                        }
                    );

                const data =
                    await response.json();

                if (
                    data.success
                ) {

                    navigate(
                        `/prejoin/${data.meetingId}`
                    );
                }

            } catch (error) {

                console.error(
                    error
                );

                setError(
                    "Unable to create meeting."
                );

            } finally {

                setLoading(false);
            }
        };

    // ======================================
    // JOIN MEETING
    // ======================================

    const joinMeeting =
        async () => {

            const id =
                meetingId.trim();

            if (!id) {

                setError(
                    "Please enter a meeting ID."
                );

                return;
            }

            try {

                setLoading(true);
                setError("");

                const response =
                    await fetch(
                        `http://localhost:5000/api/meetings/${id}`
                    );

                const data =
                    await response.json();

                if (
                    !data.exists
                ) {

                    setError(
                        "Meeting not found. Please check the meeting ID or create a new meeting."
                    );

                    return;
                }

                navigate(
                    `/prejoin/${id}`
                );

            } catch (error) {

                console.error(
                    error
                );

                setError(
                    "Unable to check meeting."
                );

            } finally {

                setLoading(false);
            }
        };

    return (

        <div className="min-h-screen bg-white">

            {/* HEADER */}

            <header className="border-b border-slate-200">

                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">

                    <div className="flex items-center gap-3">

                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl">
                            🎥
                        </div>

                        <div>

                            <h1 className="text-xl font-bold text-slate-900">
                                MeetFlow
                            </h1>

                            <p className="text-xs text-slate-500">
                                Simple video meetings
                            </p>

                        </div>

                    </div>

                </div>

            </header>

            {/* MAIN */}

            <main className="max-w-6xl mx-auto px-6 py-20">

                <div className="grid md:grid-cols-2 gap-16 items-center">

                    {/* LEFT */}

                    <div>

                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-5">

                            ● Video meetings made simple

                        </div>

                        <h2 className="text-5xl font-bold text-slate-900 leading-tight">

                            Connect with anyone,

                            <span className="text-blue-600">
                                {" "}anywhere.
                            </span>

                        </h2>

                        <p className="mt-6 text-lg text-slate-500 max-w-lg">

                            Start a secure video meeting
                            and invite others using a
                            simple meeting link.

                        </p>

                        <button
                            onClick={createMeeting}
                            disabled={loading}
                            className="mt-8 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-200 transition"
                        >

                            {loading
                                ? "Creating..."
                                : "+ Create a meeting"}

                        </button>

                    </div>

                    {/* JOIN CARD */}

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8">

                        <h3 className="text-2xl font-semibold text-slate-900">
                            Join a meeting
                        </h3>

                        <p className="text-slate-500 mt-2">
                            Enter the meeting ID shared with you.
                        </p>

                        <input
                            type="text"
                            value={meetingId}
                            onChange={(e) =>
                                setMeetingId(
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
                            placeholder="Enter meeting ID"
                            className="w-full mt-6 px-4 py-3.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                        />

                        {error && (

                            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">

                                {error}

                                <button
                                    onClick={createMeeting}
                                    className="block mt-2 text-blue-600 font-semibold hover:underline"
                                >
                                    Create a new meeting instead →
                                </button>

                            </div>

                        )}

                        <button
                            onClick={joinMeeting}
                            disabled={loading}
                            className="w-full mt-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition"
                        >

                            {loading
                                ? "Checking..."
                                : "Join meeting"}

                        </button>

                    </div>

                </div>

            </main>

        </div>
    );
}

export default Home;
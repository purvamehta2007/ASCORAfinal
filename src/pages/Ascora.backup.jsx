import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useVoice } from "../lib/useVoice";
import VisualLecture from "../components/VisualLecture";

export default function Ascora({ student = null }) {
  // ============================================================
  // BASIC STATE
  // ============================================================

  const [connected, setConnected] = useState(true);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle");
  const [loading, setLoading] = useState(true);

  const [answer, setAnswer] = useState("");

  // ============================================================
  // ADAPTIVE LECTURE
  // ============================================================

  const [lecture, setLecture] = useState(null);
  const [lectureLoading, setLectureLoading] = useState(false);
  const [lectureError, setLectureError] = useState("");

  // ============================================================
  // VOICE
  // ============================================================

  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    speak,
    clearTranscript,
  } = useVoice();

  // ============================================================
  // DOUBT QUEUE
  // ============================================================

  const [queue, setQueue] = useState([]);
  const [resolvedQueue, setResolvedQueue] = useState([]);
  const [myRequest, setMyRequest] = useState(null);

  const [queueLoading, setQueueLoading] = useState(true);
  const [raisingHand, setRaisingHand] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // ============================================================
  // CLASSROOM / STUDENT
  // ============================================================

  const classroomId = "main-classroom";
  const studentId = student?.id;

  const studentName =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  // ============================================================
  // REFS
  // ============================================================

  const isMountedRef = useRef(true);

  const speakRef = useRef(speak);
  const stopListeningRef = useRef(stopListening);
  const clearTranscriptRef = useRef(clearTranscript);

  const processedTranscriptRef = useRef("");
  const claimingRef = useRef(false);

  // ============================================================
  // KEEP LATEST VOICE FUNCTIONS
  // ============================================================

  useEffect(() => {
    speakRef.current = speak;
    stopListeningRef.current = stopListening;
    clearTranscriptRef.current = clearTranscript;
  }, [speak, stopListening, clearTranscript]);

  // ============================================================
  // MOUNT / UNMOUNT
  // ============================================================

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopListeningRef.current();
    };
  }, []);

  // ============================================================
  // LOAD STUDENT LEARNING CONTEXT
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!studentId) {
        setData(null);
        setLoading(false);
        setConnected(false);
        return;
      }

      setLoading(true);

      try {
        const response = await apiFetch(
          `/api/ascora/student/${studentId}/context`
        );

        if (!mounted) return;

        setData(response);
        setConnected(true);
      } catch (error) {
        console.error(
          "ASCORA context error:",
          error
        );

        if (!mounted) return;

        setConnected(false);
        setData(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, [studentId]);

  // ============================================================
  // EVENT LOGGER
  // ============================================================

  async function handleEvent(type) {
    setState(type);

    if (!studentId) return;

    try {
      await apiFetch("/api/ascora/event", {
        method: "POST",
        body: JSON.stringify({
          student_id: studentId,
          event: type,
        }),
      });
    } catch (error) {
      console.error(
        "ASCORA event error:",
        error
      );
    }
  }

  // ============================================================
  // LOAD QUEUE
  // ============================================================

  async function loadQueue() {
    if (!studentId) {
      setQueue([]);
      setResolvedQueue([]);
      setMyRequest(null);
      setQueueLoading(false);
      return;
    }

    try {
      const {
        data: activeData,
        error: activeError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("classroom_id", classroomId)
        .in("status", ["waiting", "serving"])
        .order("raised_at", {
          ascending: true,
        });

      if (activeError) {
        throw activeError;
      }

      if (!isMountedRef.current) return;

      const activeQueue = activeData || [];

      setQueue(activeQueue);

      const mine = activeQueue.find(
        (item) =>
          item.student_id === studentId
      );

      setMyRequest(mine || null);

      // ----------------------------------------------------------
      // RESOLVED QUEUE
      // ----------------------------------------------------------

      const {
        data: resolvedData,
        error: resolvedError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("classroom_id", classroomId)
        .eq("status", "resolved")
        .order("resolved_at", {
          ascending: false,
        })
        .limit(10);

      if (resolvedError) {
        console.error(
          "Resolved queue error:",
          resolvedError
        );
      } else if (isMountedRef.current) {
        setResolvedQueue(
          resolvedData || []
        );
      }
    } catch (error) {
      console.error(
        "Queue loading error:",
        error
      );
    } finally {
      if (isMountedRef.current) {
        setQueueLoading(false);
      }
    }
  }

  // ============================================================
  // INITIAL QUEUE LOAD
  // ============================================================

  useEffect(() => {
    setQueueLoading(true);
    loadQueue();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ============================================================
  // REALTIME QUEUE
  // ============================================================

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(
        `ascora-doubt-queue-${studentId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doubt_queue",
          filter: `classroom_id=eq.${classroomId}`,
        },
        () => {
          loadQueue();
        }
      )
      .subscribe((status) => {
        console.log(
          "ASCORA queue realtime:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ============================================================
  // CLAIM NEXT FIFO DOUBT
  // ============================================================

  async function claimNextDoubt() {
    if (claimingRef.current) {
      return null;
    }

    claimingRef.current = true;
    setClaiming(true);

    try {
      const {
        data: claimedRequest,
        error,
      } = await supabase.rpc(
        "claim_next_doubt",
        {
          p_classroom_id: classroomId,
        }
      );

      if (error) {
        console.error(
          "Claim next doubt error:",
          error
        );

        return null;
      }

      if (claimedRequest) {
        console.log(
          "ASCORA automatically serving:",
          claimedRequest.student_id
        );
      }

      await loadQueue();

      return claimedRequest;
    } catch (error) {
      console.error(
        "Unexpected claim error:",
        error
      );

      return null;
    } finally {
      claimingRef.current = false;

      if (isMountedRef.current) {
        setClaiming(false);
      }
    }
  }

  // ============================================================
  // AUTOMATICALLY CLAIM FIRST WAITING STUDENT
  // ============================================================

  useEffect(() => {
    if (!studentId) return;

    const serving = queue.some(
      (item) => item.status === "serving"
    );

    const waiting = queue.some(
      (item) => item.status === "waiting"
    );

    if (serving) return;
    if (!waiting) return;

    claimNextDoubt();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, studentId]);

  // ============================================================
  // CURRENT SERVING STUDENT
  // ============================================================

  const servingStudent = queue.find(
    (item) => item.status === "serving"
  );

  const isMyTurn =
    myRequest?.status === "serving";

  // ============================================================
  // WHEN MY REQUEST BECOMES SERVING
  // ============================================================

  useEffect(() => {
    if (myRequest?.status === "serving") {
      setState("serving");
      setAnswer("");

      setLecture(null);
      setLectureError("");
      setLectureLoading(false);

      clearTranscriptRef.current();

      processedTranscriptRef.current = "";

      console.log(
        "ASCORA: It is now",
        studentName,
        "'s turn."
      );
    } else {
      stopListeningRef.current();
    }
  }, [
    myRequest?.status,
    studentName,
  ]);

  // ============================================================
  // START MICROPHONE
  // ============================================================

  function handleStartSpeaking() {
    if (!voiceSupported) {
      setState("error");
      return;
    }

    if (!isMyTurn) {
      return;
    }

    setAnswer("");
    setLecture(null);
    setLectureError("");

    clearTranscriptRef.current();

    processedTranscriptRef.current = "";

    setState("listening");

    startListening();
  }

  // ============================================================
  // BUILD TRUSTED CLIENT CONTEXT
  // ============================================================

  function buildContext() {
    return {
      topic:
        data?.topic ||
        "Unknown",

      mastery:
        data?.mastery ??
        data?.profile?.mastery ??
        "Unknown",

      pace:
        data?.strategy?.pace ||
        data?.pace ||
        "normal",

      difficulty:
        data?.strategy?.difficulty ||
        data?.difficulty ||
        "moderate",

      scaffolding:
        data?.strategy?.scaffolding ||
        data?.strategy?.scaffoldingLevel ||
        "medium",

      visualSupport:
        data?.strategy?.visualSupport ??
        data?.strategy?.visual ??
        false,

      misconceptions:
        Array.isArray(
          data?.misconceptions
        )
          ? data.misconceptions
          : [],
    };
  }

  // ============================================================
  // GENERATE ADAPTIVE LECTURE
  // ============================================================

  async function generateAdaptiveLecture(
    doubt,
    response
  ) {
    if (!studentId || !doubt) {
      return;
    }

    setLectureLoading(true);
    setLectureError("");

    try {
      const lectureResponse =
        await apiFetch(
          "/api/ascora/lecture/generate",
          {
            method: "POST",
            body: JSON.stringify({
              studentId,

              topic:
                response?.topic ||
                data?.topic ||
                "Unknown",

              doubt,

              objective:
                "Explain the student's doubt clearly and adapt the explanation to their learning profile.",
            }),
          }
        );

      if (
        !isMountedRef.current
      ) {
        return;
      }

      const generatedLecture =
        lectureResponse?.lecture ||
        null;

      setLecture(
        generatedLecture
      );

      if (!generatedLecture) {
        setLectureError(
          "No visual explanation was generated."
        );
      }
    } catch (error) {
      console.error(
        "ASCORA lecture generation error:",
        error
      );

      if (
        isMountedRef.current
      ) {
        setLectureError(
          "Visual explanation could not be generated."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLectureLoading(false);
      }
    }
  }

  // ============================================================
  // PROCESS VOICE DOUBT
  // ============================================================

  useEffect(() => {
    const doubt = transcript.trim();

    if (!doubt) return;

    if (!isMyTurn) {
      return;
    }

    if (listening) {
      return;
    }

    if (
      doubt ===
      processedTranscriptRef.current
    ) {
      return;
    }

    processedTranscriptRef.current =
      doubt;

    console.log(
      "ASCORA received doubt:",
      doubt
    );

    let cancelled = false;

    async function generateAnswer() {
      try {
        setState("thinking");

        const context =
          buildContext();

        // ------------------------------------------------------
        // REAL AI ANSWER
        // ------------------------------------------------------

        const response =
          await apiFetch(
            "/api/ascora/answer",
            {
              method: "POST",

              body: JSON.stringify({
                doubt,

                student_context:
                  context,
              }),
            }
          );

        if (
          cancelled ||
          !isMountedRef.current
        ) {
          return;
        }

        const generatedAnswer =
          response?.answer ||
          "I wasn't able to generate an answer.";

        setAnswer(
          generatedAnswer
        );

        setState("answering");

        // ------------------------------------------------------
        // BROWSER TEXT-TO-SPEECH
        // ------------------------------------------------------

        speakRef.current(
          generatedAnswer
        );

        // ------------------------------------------------------
        // GENERATE VISUAL LECTURE
        // ------------------------------------------------------

        await generateAdaptiveLecture(
          doubt,
          response
        );
      } catch (error) {
        console.error(
          "ASCORA answer error:",
          error
        );

        if (
          cancelled ||
          !isMountedRef.current
        ) {
          return;
        }

        setState("error");

        setAnswer(
          "I'm sorry, I couldn't generate an answer right now."
        );
      }
    }

    generateAnswer();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transcript,
    listening,
    isMyTurn,
  ]);

  // ============================================================
  // RESOLVE CURRENT DOUBT
  // ============================================================

  async function resolveCurrentDoubt() {
    if (!myRequest?.id) {
      return;
    }

    if (
      myRequest.status !== "serving"
    ) {
      return;
    }

    if (resolving) {
      return;
    }

    setResolving(true);

    try {
      stopListeningRef.current();

      const {
        data: resolvedRequest,
        error,
      } = await supabase.rpc(
        "resolve_doubt",
        {
          p_request_id:
            myRequest.id,
        }
      );

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      console.log(
        "ASCORA resolved request:",
        resolvedRequest
      );

      setState("resolved");

      setAnswer("");
      setLecture(null);
      setLectureError("");
      setLectureLoading(false);

      clearTranscriptRef.current();

      processedTranscriptRef.current =
        "";

      await loadQueue();

      if (!isMountedRef.current) {
        return;
      }

      // --------------------------------------------------------
      // Immediately claim next FIFO student
      // --------------------------------------------------------

      await claimNextDoubt();

      if (!isMountedRef.current) {
        return;
      }

      setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }

        setState("idle");
      }, 1200);
    } catch (error) {
      console.error(
        "Resolve doubt error:",
        error
      );

      if (isMountedRef.current) {
        alert(
          "Unable to resolve this doubt. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setResolving(false);
      }
    }
  }

  // ============================================================
  // RAISE HAND
  // ============================================================

  async function raiseHand() {
    if (!studentId) {
      alert(
        "Please log in before raising your hand."
      );

      return;
    }

    if (myRequest) {
      return;
    }

    setRaisingHand(true);

    try {
      const {
        data: existingRequest,
        error: existingError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("student_id", studentId)
        .eq(
          "classroom_id",
          classroomId
        )
        .in("status", [
          "waiting",
          "serving",
        ])
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRequest) {
        setMyRequest(
          existingRequest
        );

        await loadQueue();

        return;
      }

      // Database controls raised_at.
      const {
        data: newRequest,
        error,
      } = await supabase
        .from("doubt_queue")
        .insert({
          student_id: studentId,
          classroom_id:
            classroomId,
          status: "waiting",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      console.log(
        "Doubt raised:",
        newRequest
      );

      setMyRequest(newRequest);

      await loadQueue();
    } catch (error) {
      console.error(
        "Raise hand error:",
        error
      );

      // Duplicate active request is harmless.
      if (
        error?.code === "23505" ||
        /duplicate|already/i.test(
          error?.message || ""
        )
      ) {
        await loadQueue();
      } else if (
        isMountedRef.current
      ) {
        alert(
          "Unable to raise your hand. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setRaisingHand(false);
      }
    }
  }

  // ============================================================
  // LOWER HAND
  // ============================================================

  async function lowerHand() {
    if (!myRequest?.id) {
      return;
    }

    try {
      stopListeningRef.current();

      const { error } =
        await supabase
          .from("doubt_queue")
          .update({
            status: "cancelled",
          })
          .eq(
            "id",
            myRequest.id
          )
          .eq(
            "student_id",
            studentId
          );

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      setMyRequest(null);

      setAnswer("");
      setLecture(null);
      setLectureError("");
      setLectureLoading(false);

      clearTranscriptRef.current();

      processedTranscriptRef.current =
        "";

      setState("idle");

      await loadQueue();

      await claimNextDoubt();
    } catch (error) {
      console.error(
        "Lower hand error:",
        error
      );

      if (isMountedRef.current) {
        alert(
          "Unable to lower your hand. Please try again."
        );
      }
    }
  }

  // ============================================================
  // QUEUE POSITION
  // ============================================================

  const myRequestIndex =
    myRequest?.status === "waiting"
      ? queue.findIndex(
          (item) =>
            item.id ===
            myRequest.id
        )
      : -1;

  const myPosition =
    myRequestIndex >= 0
      ? myRequestIndex + 1
      : null;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="grid grid-2">

      {/* ======================================================
          ASCORA ROBOT
      ======================================================= */}

      <div
        className="card"
        style={{
          textAlign: "center",
        }}
      >
        <div className="avatar">
          {connected ? "✦" : "!"}
        </div>

        <h1>ASCORA</h1>

        <span className="pill">
          {connected
            ? "● Connected"
            : "○ Offline"}
        </span>

        <p
          className="muted"
          style={{
            marginTop: 12,
          }}
        >
          Robot state:{" "}
          <strong>
            {state}
          </strong>
        </p>

        <p className="muted">
          Student: {studentName}
        </p>

        {servingStudent && (
          <div
            className="item"
            style={{
              marginTop: 16,
            }}
          >
            <strong>
              🎤 ASCORA is serving
            </strong>

            <p className="muted">
              One student is currently
              being helped.
            </p>

            {isMyTurn && (
              <p
                style={{
                  fontWeight: "bold",
                  marginTop: 8,
                }}
              >
                🎤 It is your turn!
              </p>
            )}
          </div>
        )}

        <div
          className="row"
          style={{
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          <button
            className="btn"
            onClick={() =>
              handleEvent(
                "listening"
              )
            }
          >
            🎤 Listen
          </button>

          <button
            className="btn secondary"
            onClick={() =>
              handleEvent(
                "thinking"
              )
            }
          >
            🧠 Think
          </button>

          <button
            className="btn success"
            onClick={() =>
              handleEvent(
                "explaining"
              )
            }
          >
            ✦ Teach
          </button>
        </div>
      </div>

      {/* ======================================================
          STUDENT CONTEXT
      ======================================================= */}

      <div className="card">
        <h2>
          Current student context
        </h2>

        {loading ? (
          <p className="muted">
            ASCORA is loading the
            student's learning context...
          </p>
        ) : data ? (
          <div className="list">

            <div className="item">
              <strong>
                Topic:
              </strong>{" "}
              {data.topic ||
                "Unknown"}
            </div>

            <div className="item">
              <strong>
                Mastery:
              </strong>{" "}
              {data.mastery !==
              undefined
                ? `${Math.round(
                    Number(
                      data.mastery
                    ) * 100
                  )}%`
                : "Unknown"}
            </div>

            <div className="item">
              <strong>
                Pace:
              </strong>{" "}
              {data.strategy?.pace ||
                data.pace ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Difficulty:
              </strong>{" "}
              {data.strategy
                ?.difficulty ||
                data.difficulty ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Scaffolding:
              </strong>{" "}
              {data.strategy
                ?.scaffolding ||
                data.strategy
                  ?.scaffoldingLevel ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Visual support:
              </strong>{" "}
              {data.strategy
                ?.visualSupport ??
              data.strategy?.visual
                ? "Enabled"
                : "Standard"}
            </div>

          </div>
        ) : (
          <p className="muted">
            No learning context
            available.
          </p>
        )}
      </div>

      {/* ======================================================
          NEED HELP
      ======================================================= */}

      <div className="card">
        <h2>
          🙋 Need Help?
        </h2>

        <p className="muted">
          Raise your hand and ASCORA
          will serve students in the
          order they raised their hands.
        </p>

        {!myRequest && (
          <button
            className="btn"
            onClick={raiseHand}
            disabled={raisingHand}
            style={{
              width: "100%",
              marginTop: 20,
              padding: "14px",
              fontSize: "16px",
            }}
          >
            {raisingHand
              ? "Raising Hand..."
              : "🙋 Raise Hand"}
          </button>
        )}

        {myRequest && (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >

            {/* ==================================================
                SERVING
            =================================================== */}

            {myRequest.status ===
              "serving" && (
              <>
                <h3>
                  🎤 ASCORA is serving you
                </h3>

                <p className="muted">
                  Tell ASCORA your doubt.
                </p>

                {voiceSupported ? (
                  <button
                    className="btn"
                    onClick={
                      listening
                        ? stopListening
                        : handleStartSpeaking
                    }
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "14px",
                    }}
                  >
                    {listening
                      ? "⏹ Stop Listening"
                      : "🎤 Start Speaking"}
                  </button>
                ) : (
                  <p className="muted">
                    Voice input is not
                    supported in this browser.
                  </p>
                )}

                {listening && (
                  <p
                    style={{
                      marginTop: 12,
                      fontWeight: "bold",
                    }}
                  >
                    🔴 ASCORA is listening...
                  </p>
                )}

                {voiceError && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      ⚠️ Voice error
                    </strong>

                    <p className="muted">
                      {voiceError}
                    </p>
                  </div>
                )}

                {/* ----------------------------------------------
                    TRANSCRIPT
                ----------------------------------------------- */}

                {transcript && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      📝 Your doubt
                    </strong>

                    <p
                      style={{
                        marginTop: 8,
                      }}
                    >
                      {transcript}
                    </p>
                  </div>
                )}

                {/* ----------------------------------------------
                    THINKING
                ----------------------------------------------- */}

                {state === "thinking" && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    🧠 ASCORA is thinking...
                  </p>
                )}

                {/* ----------------------------------------------
                    AI ANSWER
                ----------------------------------------------- */}

                {answer && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      🤖 ASCORA
                    </strong>

                    <p
                      style={{
                        marginTop: 8,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {answer}
                    </p>
                  </div>
                )}

                {state ===
                  "answering" &&
                  answer && (
                    <p
                      className="muted"
                      style={{
                        marginTop: 12,
                      }}
                    >
                      🔊 ASCORA is answering...
                    </p>
                  )}

                {/* ----------------------------------------------
                    ADAPTIVE VISUAL LECTURE
                ----------------------------------------------- */}

                {lectureLoading && (
                  <div
                    className="item"
                    style={{
                      marginTop: 18,
                      textAlign: "center",
                    }}
                  >
                    <strong>
                      🎓 ASCORA
                    </strong>

                    <p
                      className="muted"
                      style={{
                        marginTop: 8,
                      }}
                    >
                      Preparing a
                      personalized visual
                      explanation...
                    </p>
                  </div>
                )}

                {lectureError && (
                  <div
                    className="item"
                    style={{
                      marginTop: 18,
                      textAlign: "center",
                    }}
                  >
                    <p className="muted">
                      ⚠️{" "}
                      {lectureError}
                    </p>
                  </div>
                )}

                {lecture && (
                  <div
                    style={{
                      marginTop: 20,
                      textAlign: "left",
                    }}
                  >
                    <h3
                      style={{
                        marginBottom: 12,
                      }}
                    >
                      🎓 Personalized
                      Explanation
                    </h3>

                    {/* Support both possible
                        response structures. */}

                    <VisualLecture
                      visual={
                        lecture.visual ||
                        lecture.visuals?.[0] ||
                        lecture.steps?.find(
                          (step) =>
                            step.visual
                        )?.visual ||
                        null
                      }
                    />
                  </div>
                )}

                {/* ----------------------------------------------
                    ERROR
                ----------------------------------------------- */}

                {state === "error" && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    ⚠️ Something went wrong.
                  </p>
                )}

                {/* ----------------------------------------------
                    RESOLVED
                ----------------------------------------------- */}

                {state ===
                  "resolved" && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    <strong>
                      ✅ Doubt Resolved
                    </strong>

                    <p className="muted">
                      The next student
                      can now be served.
                    </p>
                  </div>
                )}

                {/* ----------------------------------------------
                    RESOLVE BUTTON
                ----------------------------------------------- */}

                {answer &&
                  state !== "resolved" && (
                    <button
                      className="btn success"
                      onClick={
                        resolveCurrentDoubt
                      }
                      disabled={resolving}
                      style={{
                        width: "100%",
                        marginTop: 16,
                      }}
                    >
                      {resolving
                        ? "Resolving..."
                        : "✅ Mark Doubt Resolved"}
                    </button>
                  )}
              </>
            )}

            {/* ==================================================
                WAITING
            =================================================== */}

            {myRequest.status ===
              "waiting" && (
              <>
                <h3>
                  🙋 Hand Raised
                </h3>

                <p
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    margin: "10px 0",
                  }}
                >
                  {myPosition
                    ? `#${myPosition}`
                    : "—"}
                </p>

                <p className="muted">
                  You are in the queue.
                  ASCORA will serve students
                  in first-come-first-served
                  order.
                </p>
              </>
            )}

            <button
              className="btn secondary"
              onClick={lowerHand}
              disabled={resolving}
              style={{
                marginTop: 12,
              }}
            >
              Lower Hand
            </button>

          </div>
        )}
      </div>

      {/* ======================================================
          LIVE QUEUE
      ======================================================= */}

      <div className="card">

        <div
          className="row"
          style={{
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2>
              Live Doubt Queue
            </h2>

            <p className="muted">
              First-come, first-served.
            </p>
          </div>

          <span className="pill">
            {queue.length}{" "}
            {queue.length === 1
              ? "student"
              : "students"}
          </span>
        </div>

        {claiming && (
          <p
            className="muted"
            style={{
              marginTop: 12,
            }}
          >
            ASCORA is selecting the
            next student...
          </p>
        )}

        {queueLoading ? (
          <p
            className="muted"
            style={{
              marginTop: 20,
            }}
          >
            Loading classroom queue...
          </p>
        ) : queue.length === 0 ? (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "30px",
              }}
            >
              🙌
            </p>

            <strong>
              No students waiting
            </strong>

            <p className="muted">
              ASCORA is available for
              doubts.
            </p>
          </div>
        ) : (
          <div
            className="list"
            style={{
              marginTop: 20,
            }}
          >
            {queue.map(
              (item, index) => {
                const isMe =
                  item.student_id ===
                  studentId;

                const isServing =
                  item.status ===
                  "serving";

                return (
                  <div
                    className="item"
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {isMe
                          ? "You"
                          : `Student ${
                              index + 1
                            }`}
                      </strong>

                      <p
                        className="muted"
                        style={{
                          margin:
                            "4px 0 0",
                        }}
                      >
                        {isServing
                          ? "ASCORA is serving"
                          : `Waiting · Position #${
                              index + 1
                            }`}
                      </p>
                    </div>

                    <span className="pill">
                      {isServing
                        ? "🎤 Serving"
                        : `#${index + 1}`}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}

        {servingStudent && (
          <div
            className="item"
            style={{
              marginTop: 16,
              textAlign: "center",
            }}
          >
            <strong>
              🎤 ASCORA is currently
              helping a student
            </strong>

            <p className="muted">
              Other students remain
              waiting in FIFO order.
            </p>
          </div>
        )}
      </div>

      {/* ======================================================
          RESOLVED DOUBTS
      ======================================================= */}

      <div className="card">

        <h2>
          Resolved Doubts
        </h2>

        <p className="muted">
          Recently completed ASCORA
          sessions.
        </p>

        {resolvedQueue.length ===
        0 ? (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "28px",
              }}
            >
              📚
            </p>

            <strong>
              No resolved doubts yet
            </strong>

            <p className="muted">
              Completed sessions will
              appear here.
            </p>
          </div>
        ) : (
          <div
            className="list"
            style={{
              marginTop: 20,
            }}
          >
            {resolvedQueue.map(
              (item) => (
                <div
                  className="item"
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>
                      {item.student_id ===
                      studentId
                        ? "You"
                        : "Student"}
                    </strong>

                    <p
                      className="muted"
                      style={{
                        marginTop: 4,
                      }}
                    >
                      Doubt successfully
                      answered
                    </p>
                  </div>

                  <span className="pill">
                    ✅ Resolved
                  </span>
                </div>
              )
            )}
          </div>
        )}

      </div>

      {/* ======================================================
          ADAPTIVE LOOP
      ======================================================= */}

      <div className="card">

        <h2>
          ASCORA adaptive loop
        </h2>

        <div className="grid grid-3">

          <div className="item">
            <strong>
              01 · Observe
            </strong>

            <p className="muted">
              ASCORA receives assessment
              and interaction signals.
            </p>
          </div>

          <div className="item">
            <strong>
              02 · Adapt
            </strong>

            <p className="muted">
              Teaching adapts to mastery,
              misconceptions and
              learning context.
            </p>
          </div>

          <div className="item">
            <strong>
              03 · Teach
            </strong>

            <p className="muted">
              ASCORA delivers a
              personalized response
              through voice and the
              classroom interface.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
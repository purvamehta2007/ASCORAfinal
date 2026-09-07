import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useVoice } from "../lib/useVoice";
import VisualLecture from "../components/VisualLecture";

export default function Ascora({ student = null }) {
  // ============================================================
  // BASIC ASCORA STATE
  // ============================================================

  const [connected, setConnected] = useState(true);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle");
  const [loading, setLoading] = useState(true);

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

  const [answer, setAnswer] = useState("");

  // ============================================================
  // ADAPTIVE PROFILE
  // ============================================================

  const [activeProfile, setActiveProfile] = useState(null);
  const [activeStrategy, setActiveStrategy] = useState(null);

  // ============================================================
  // QUEUE
  // ============================================================

  const [queue, setQueue] = useState([]);
  const [resolvedQueue, setResolvedQueue] = useState([]);
  const [myRequest, setMyRequest] = useState(null);

  const [queueLoading, setQueueLoading] = useState(true);
  const [raisingHand, setRaisingHand] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [lastResolved, setLastResolved] = useState(false);

  // ============================================================
  // CONSTANTS
  // ============================================================

  const classroomId = "main-classroom";
  const studentId = student?.id;

  // ============================================================
  // REFS
  // ============================================================

  const speakRef = useRef(speak);
  const stopListeningRef = useRef(stopListening);
  const clearTranscriptRef = useRef(clearTranscript);

  const resolveCurrentDoubtRef = useRef(null);

  const isMountedRef = useRef(true);

  const processedTranscriptRef = useRef("");

  const processingDoubtRef = useRef(false);

  // ============================================================
  // KEEP LATEST VOICE FUNCTIONS IN REFS
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
      stopListeningRef.current?.();
    };
  }, []);

  // ============================================================
  // STUDENT NAME
  // ============================================================

  const studentName =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  // ============================================================
  // LOAD STUDENT CONTEXT
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!studentId) {
        if (!mounted) return;

        setData({
          topic: "Linear Equations",
          mastery: 0.43,
          strategy: {
            pace: "slow",
            visual: true,
            guided_questions: true,
          },
          profile: {
            currentTopic: "Linear Equations",
            mastery: 0.43,
            learningPace: "slow",
            scaffoldingLevel: "high",
            visualSupport: true,
            weakConcepts: [],
          },
        });

        setActiveProfile(null);
        setActiveStrategy(null);
        setConnected(false);
        setLoading(false);

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

        if (response?.profile) {
          setActiveProfile(response.profile);
        }

        if (response?.adaptiveStrategy) {
          setActiveStrategy(response.adaptiveStrategy);
        }
      } catch (error) {
        console.error("ASCORA context error:", error);

        if (!mounted) return;

        setConnected(false);

        setData({
          topic: "Linear Equations",
          mastery: 0.43,
          strategy: {
            pace: "slow",
            visual: true,
            guided_questions: true,
          },
        });
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
  // ROBOT EVENT LOGGER
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
      console.error("ASCORA event error:", error);
    }
  }

  // ============================================================
  // LOAD QUEUE
  // ============================================================

  async function loadQueue() {
    if (!studentId) {
      if (!isMountedRef.current) return;

      setQueue([]);
      setResolvedQueue([]);
      setMyRequest(null);
      setQueueLoading(false);

      return;
    }

    setQueueLoading(true);

    try {
      // ----------------------------------------------------------
      // ACTIVE QUEUE
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // CURRENT STUDENT REQUEST
      // ----------------------------------------------------------

      const mine = activeQueue.find(
        (item) => item.student_id === studentId
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

      if (!isMountedRef.current) return;

      if (resolvedError) {
        console.error(
          "Resolved queue error:",
          resolvedError
        );
      } else {
        setResolvedQueue(resolvedData || []);
      }
    } catch (error) {
      console.error("Queue loading error:", error);
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
    loadQueue();

    // loadQueue is intentionally called on student change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ============================================================
  // REALTIME QUEUE
  // ============================================================

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`ascora-doubt-queue-${studentId}`)
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
  // SERVING STUDENT DETECTION
  // ============================================================

  useEffect(() => {
    if (myRequest?.status === "serving") {
      setState("serving");

      setAnswer("");
      setLastResolved(false);

      clearTranscriptRef.current?.();

      processedTranscriptRef.current = "";
      processingDoubtRef.current = false;
    } else {
      stopListeningRef.current?.();
    }
  }, [myRequest?.status]);

  // ============================================================
  // START MICROPHONE
  // ============================================================

  function handleStartSpeaking() {
    if (!voiceSupported) {
      setState("error");
      return;
    }

    if (!myRequest || myRequest.status !== "serving") {
      return;
    }

    if (processingDoubtRef.current) {
      return;
    }

    setAnswer("");

    clearTranscriptRef.current?.();

    processedTranscriptRef.current = "";

    setState("listening");

    startListening();
  }

  // ============================================================
  // STOP MICROPHONE
  // ============================================================

  function handleStopSpeaking() {
    stopListeningRef.current?.();

    if (myRequest?.status === "serving") {
      setState("thinking");
    }
  }

  // ============================================================
  // BUILD ADAPTIVE AI CONTEXT
  // ============================================================

  function buildAIContext() {
    const profile =
      activeProfile ||
      data?.profile ||
      {};

    const strategy =
      activeStrategy ||
      data?.adaptiveStrategy ||
      {};

    const topic =
      profile.currentTopic ||
      strategy.topic ||
      data?.topic ||
      "Linear Equations";

    const mastery =
      profile.mastery ??
      data?.mastery ??
      0.43;

    const pace =
      profile.learningPace ||
      strategy.pace ||
      data?.strategy?.pace ||
      "normal";

    const difficulty =
      strategy.difficulty ||
      profile.difficulty ||
      (Number(mastery) < 0.5
        ? "beginner"
        : "moderate");

    const scaffolding =
      profile.scaffoldingLevel ||
      strategy.scaffolding ||
      "medium";

    const visualSupport =
      profile.visualSupport ??
      strategy.visualSupport ??
      data?.strategy?.visual ??
      true;

    const misconceptions =
      profile.misconceptions ||
      profile.weakConcepts ||
      data?.misconceptions ||
      [];

    return {
      topic,
      mastery,
      pace,
      difficulty,
      scaffolding,
      visualSupport,
      misconceptions,
    };
  }

  // ============================================================
  // PROCESS STUDENT DOUBT
  //
  // IMPORTANT:
  // This now directly calls /api/ascora/answer.
  //
  // That route calls:
  //
  // ascora.js
  //    ↓
  // adaptiveAnswer.js
  //    ↓
  // aiProvider.js
  //    ↓
  // Hugging Face
  //
  // So the real HF AI is used in the actual ASCORA flow.
  // ============================================================

  useEffect(() => {
    const doubt = transcript.trim();

    if (!doubt) return;

    if (myRequest?.status !== "serving") {
      return;
    }

    // Wait until speech recognition finishes.
    if (listening) {
      return;
    }

    // Prevent duplicate requests.
    if (doubt === processedTranscriptRef.current) {
      return;
    }

    if (processingDoubtRef.current) {
      return;
    }

    processedTranscriptRef.current = doubt;
    processingDoubtRef.current = true;

    console.log(
      "ASCORA received student doubt:",
      doubt
    );

    setState("thinking");

    let cancelled = false;

    async function generateAIAnswer() {
      try {
        const context = buildAIContext();

        console.log(
          "ASCORA AI context:",
          context
        );

        const response = await apiFetch(
          "/api/ascora/answer",
          {
            method: "POST",
            body: JSON.stringify({
              doubt,
              student_context: context,
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
          response?.answer?.trim();

        if (!generatedAnswer) {
          throw new Error(
            "ASCORA received an empty AI response."
          );
        }

        console.log(
          "ASCORA AI answer received."
        );

        setAnswer(generatedAnswer);
        setState("answering");

        // ------------------------------------------------------
        // SPEAK THE AI RESPONSE
        //
        // This waits for actual speech completion if useVoice
        // returns a promise from speech synthesis.
        // ------------------------------------------------------

        try {
          await speakRef.current(
            generatedAnswer
          );
        } catch (speechError) {
          console.error(
            "ASCORA TTS error:",
            speechError
          );
        }

        if (
          cancelled ||
          !isMountedRef.current
        ) {
          return;
        }

        // ------------------------------------------------------
        // RESOLVE ONLY AFTER ANSWER HAS BEEN DELIVERED
        // ------------------------------------------------------

        await resolveCurrentDoubtRef.current?.();
      } catch (error) {
        console.error(
          "ASCORA AI answer error:",
          error
        );

        if (
          cancelled ||
          !isMountedRef.current
        ) {
          return;
        }

        setAnswer(
          "I'm having trouble reaching my AI teaching engine right now. Please try asking your doubt again."
        );

        setState("error");

        processingDoubtRef.current = false;
      }
    }

    generateAIAnswer();

    return () => {
      cancelled = true;
    };

    // We intentionally process a transcript only when it changes
    // and when the student's serving status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transcript,
    listening,
    myRequest?.status,
  ]);

  // ============================================================
  // RESOLVE CURRENT DOUBT
  // ============================================================

  async function resolveCurrentDoubt() {
    if (!myRequest?.id) {
      processingDoubtRef.current = false;
      return;
    }

    if (resolving) {
      return;
    }

    setResolving(true);

    try {
      stopListeningRef.current?.();

      const {
        data: resolvedRequest,
        error,
      } = await supabase.rpc(
        "resolve_doubt",
        {
          p_request_id: myRequest.id,
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
      setLastResolved(true);

      setAnswer("");

      clearTranscriptRef.current?.();

      processedTranscriptRef.current = "";
      processingDoubtRef.current = false;

      await loadQueue();

      if (!isMountedRef.current) {
        return;
      }

      // Keep confirmation visible briefly.
      setTimeout(() => {
        if (isMountedRef.current) {
          setState("idle");
          setLastResolved(false);
        }
      }, 2000);
    } catch (error) {
      console.error(
        "Resolve doubt error:",
        error
      );

      processingDoubtRef.current = false;

      if (isMountedRef.current) {
        setState("error");

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

  // Always expose the latest function to async effects.
  resolveCurrentDoubtRef.current =
    resolveCurrentDoubt;

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
      // --------------------------------------------------------
      // CHECK EXISTING ACTIVE REQUEST
      // --------------------------------------------------------

      const {
        data: existingRequest,
        error: existingError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("student_id", studentId)
        .eq("classroom_id", classroomId)
        .in("status", [
          "waiting",
          "serving",
        ])
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!isMountedRef.current) {
        return;
      }

      if (existingRequest) {
        setMyRequest(existingRequest);

        await loadQueue();

        return;
      }

      // --------------------------------------------------------
      // CREATE REQUEST
      // --------------------------------------------------------

      const {
        data: newRequest,
        error,
      } = await supabase
        .from("doubt_queue")
        .insert({
          student_id: studentId,
          classroom_id: classroomId,
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
        "ASCORA doubt raised:",
        newRequest
      );

      setMyRequest(newRequest);
      setLastResolved(false);

      setState("waiting");

      await loadQueue();
    } catch (error) {
      console.error(
        "Raise hand error:",
        error
      );

      const isDuplicate =
        error?.code === "23505" ||
        /duplicate|already/i.test(
          error?.message || ""
        );

      if (isDuplicate) {
        await loadQueue();
      } else if (isMountedRef.current) {
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
      stopListeningRef.current?.();

      const { error } = await supabase
        .from("doubt_queue")
        .update({
          status: "cancelled",
        })
        .eq("id", myRequest.id)
        .eq("student_id", studentId);

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      setMyRequest(null);
      setAnswer("");
      setLastResolved(false);

      clearTranscriptRef.current?.();

      processedTranscriptRef.current = "";
      processingDoubtRef.current = false;

      setState("idle");

      await loadQueue();
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
            item.id === myRequest.id
        )
      : -1;

  const myPosition =
    myRequestIndex >= 0
      ? myRequestIndex + 1
      : null;

  // ============================================================
  // CURRENT SERVING STUDENT
  // ============================================================

  const servingStudent = queue.find(
    (item) =>
      item.status === "serving"
  );

  const isMyTurn =
    myRequest?.status === "serving";

  // ============================================================
  // CURRENT PROFILE
  // ============================================================

  const displayProfile =
    activeProfile ||
    data?.profile ||
    null;

  const displayStrategy =
    activeStrategy ||
    data?.adaptiveStrategy ||
    null;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="grid grid-2">

      {/* ======================================================
          ASCORA ROBOT CARD
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
            : "○ Offline Mode"}
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

        {/* CURRENT TURN */}

        {isMyTurn && (
          <div
            className="item"
            style={{
              marginTop: 16,
            }}
          >
            <strong>
              🎤 Your turn
            </strong>

            <p className="muted">
              ASCORA is currently serving you.
            </p>
          </div>
        )}

        {/* MANUAL ROBOT CONTROLS */}

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
              handleEvent("listening")
            }
          >
            🎤 Listen
          </button>

          <button
            className="btn secondary"
            onClick={() =>
              handleEvent("thinking")
            }
          >
            🧠 Think
          </button>

          <button
            className="btn success"
            onClick={() =>
              handleEvent("explaining")
            }
          >
            ✦ Teach
          </button>
        </div>
      </div>

      {/* ======================================================
          CURRENT STUDENT CONTEXT
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
                "Linear Equations"}
            </div>

            <div className="item">
              <strong>
                Mastery:
              </strong>{" "}
              {Math.round(
                Number(
                  data.mastery || 0
                ) * 100
              )}
              %
            </div>

            <div className="item">
              <strong>
                Pace:
              </strong>{" "}
              {data.strategy?.pace ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Visual support:
              </strong>{" "}
              {data.strategy?.visual
                ? "High"
                : "Standard"}
            </div>

            <div className="item">
              <strong>
                Guided questions:
              </strong>{" "}
              {data.strategy
                ?.guided_questions
                ? "Enabled"
                : "Off"}
            </div>

          </div>
        ) : (
          <p className="muted">
            No learning context available yet.
          </p>
        )}
      </div>

      {/* ======================================================
          ASCORA LEARNING PROFILE
      ======================================================= */}

      {displayProfile && (
        <div className="card">
          <h2>
            ASCORA Learning Profile
          </h2>

          <div className="list">

            <div className="item">
              <strong>
                Topic:
              </strong>{" "}
              {displayProfile.currentTopic ||
                data?.topic ||
                "Unknown"}
            </div>

            <div className="item">
              <strong>
                Mastery:
              </strong>{" "}
              {Math.round(
                Number(
                  displayProfile.mastery || 0
                ) * 100
              )}
              %
            </div>

            <div className="item">
              <strong>
                Weak concept:
              </strong>{" "}
              {displayProfile.weakConcepts?.[0] ||
                "None detected yet"}
            </div>

            <div className="item">
              <strong>
                Learning pace:
              </strong>{" "}
              {displayProfile.learningPace ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Scaffolding:
              </strong>{" "}
              {displayProfile.scaffoldingLevel ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Visual support:
              </strong>{" "}
              {displayProfile.visualSupport
                ? "Enabled"
                : "Off"}
            </div>

          </div>

          {displayStrategy?.reason && (
            <p
              className="muted"
              style={{
                marginTop: 12,
              }}
            >
              ASCORA adapted the teaching strategy
              because:{" "}
              {displayStrategy.reason}
            </p>
          )}

          {displayProfile.fallback && (
            <div
              className="item"
              style={{
                marginTop: 12,
              }}
            >
              <p className="muted">
                ⚠️ Some profile values use
                fallback defaults because ASCORA
                has not collected enough learning
                data yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          NEED HELP / DOUBT QUEUE
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
            <h2
              style={{
                marginBottom: 4,
              }}
            >
              🙋 Need Help?
            </h2>

            <p className="muted">
              Raise your hand and ASCORA
              will serve students in queue order.
            </p>
          </div>
        </div>

        {/* ====================================================
            RESOLVED CONFIRMATION
        ===================================================== */}

        {!myRequest &&
          lastResolved && (
            <div
              className="item"
              style={{
                marginTop: 20,
                textAlign: "center",
              }}
            >
              <strong>
                ✅ Doubt Resolved
              </strong>

              <p className="muted">
                ASCORA has answered your doubt.
                The next student can now be served.
              </p>
            </div>
          )}

        {/* ====================================================
            RAISE HAND
        ===================================================== */}

        {!myRequest &&
          !lastResolved && (
            <div
              style={{
                marginTop: 20,
              }}
            >
              <button
                className="btn"
                onClick={raiseHand}
                disabled={raisingHand}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "16px",
                }}
              >
                {raisingHand
                  ? "Raising Hand..."
                  : "🙋 Raise Hand"}
              </button>
            </div>
          )}

        {/* ====================================================
            CURRENT STUDENT REQUEST
        ===================================================== */}

        {myRequest && (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >

            {/* =================================================
                SERVING
            ================================================== */}

            {myRequest.status ===
              "serving" && (
              <>
                <h3>
                  🎤 ASCORA is serving you
                </h3>

                <p className="muted">
                  You are the current student.
                  Tell ASCORA your doubt.
                </p>

                {/* MICROPHONE */}

                {voiceSupported ? (
                  <button
                    className="btn"
                    onClick={
                      listening
                        ? handleStopSpeaking
                        : handleStartSpeaking
                    }
                    disabled={
                      processingDoubtRef.current ||
                      state === "thinking" ||
                      state === "answering" ||
                      resolving
                    }
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "14px",
                      fontSize: "16px",
                    }}
                  >
                    {listening
                      ? "⏹ Stop Listening"
                      : "🎤 Start Speaking"}
                  </button>
                ) : (
                  <p className="muted">
                    Voice input is not supported
                    in this browser.
                  </p>
                )}

                {/* LISTENING */}

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

                {/* THINKING */}

                {state === "thinking" && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 12,
                      fontWeight: "bold",
                    }}
                  >
                    🧠 ASCORA is thinking...
                  </p>
                )}

                {/* ANSWERING */}

                {state === "answering" && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 12,
                      fontWeight: "bold",
                    }}
                  >
                    🔊 ASCORA is answering...
                  </p>
                )}

                {/* VOICE ERROR */}

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

                {/* TRANSCRIPT */}

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

                {/* =================================================
                    AI ANSWER
                ================================================== */}

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
                        marginTop: 10,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.6,
                      }}
                    >
                      {answer}
                    </p>
                  </div>
                )}

                {/* =================================================
                    RESOLVED
                ================================================== */}

                {state === "resolved" && (
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
                      ASCORA has answered your doubt.
                      The next student can now be served.
                    </p>
                  </div>
                )}

                {/* =================================================
                    MANUAL RESOLVE
                ================================================== */}

                {answer &&
                  state === "answering" && (
                    <button
                      className="btn success"
                      onClick={
                        resolveCurrentDoubt
                      }
                      disabled={resolving}
                      style={{
                        width: "100%",
                        marginTop: 12,
                      }}
                    >
                      {resolving
                        ? "Resolving..."
                        : "✅ Mark Doubt Resolved"}
                    </button>
                  )}

                {/* ERROR */}

                {state === "error" && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      ⚠️ ASCORA encountered a problem
                    </strong>

                    <p className="muted">
                      Please try asking your doubt
                      again.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* =================================================
                WAITING
            ================================================== */}

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
                  in the order they raised their hands.
                </p>
              </>
            )}

            {/* =================================================
                LOWER HAND
            ================================================== */}

            {(myRequest.status ===
              "waiting" ||
              myRequest.status ===
                "serving") && (
              <button
                className="btn secondary"
                onClick={lowerHand}
                style={{
                  marginTop: 12,
                }}
                disabled={resolving}
              >
                Lower Hand
              </button>
            )}

          </div>
        )}
      </div>

      {/* ======================================================
          LIVE CLASSROOM QUEUE
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
              Students are served first-come,
              first-served.
            </p>
          </div>

          <span className="pill">
            {queue.length}{" "}
            {queue.length === 1
              ? "student"
              : "students"}
          </span>
        </div>

        {/* LOADING */}

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
              ASCORA is available for doubts.
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
                      alignItems: "center",
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
                          : `Queue position #${
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

        {/* CURRENT SERVING */}

        {servingStudent && (
          <div
            className="item"
            style={{
              marginTop: 16,
              textAlign: "center",
            }}
          >
            <strong>
              🎤 ASCORA is currently helping
              one student
            </strong>

            <p className="muted">
              The microphone is available only
              to the student currently being served.
            </p>

            {servingStudent.student_id ===
              studentId && (
              <p
                style={{
                  marginTop: 8,
                  fontWeight: "bold",
                }}
              >
                🎤 It is your turn!
              </p>
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          RESOLVED DOUBTS
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
              Resolved Doubts
            </h2>

            <p className="muted">
              Recently completed ASCORA sessions.
            </p>
          </div>

          <span className="pill">
            {resolvedQueue.length} resolved
          </span>
        </div>

        {resolvedQueue.length === 0 ? (
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
              Completed sessions will appear here.
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
              (item) => {
                const isMe =
                  item.student_id ===
                  studentId;

                return (
                  <div
                    className="item"
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {isMe
                          ? "You"
                          : "Student"}
                      </strong>

                      <p
                        className="muted"
                        style={{
                          marginTop: 4,
                        }}
                      >
                        Doubt successfully answered
                      </p>
                    </div>

                    <span className="pill">
                      ✅ Resolved
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          AI PIPELINE STATUS
      ======================================================= */}

      <div className="card">

        <h2>
          🤖 ASCORA AI Pipeline
        </h2>

        <div className="list">

          <div className="item">
            <strong>
              01 · Student interaction
            </strong>

            <p className="muted">
              Student speaks naturally using
              the microphone.
            </p>
          </div>

          <div className="item">
            <strong>
              02 · Speech recognition
            </strong>

            <p className="muted">
              Browser speech recognition converts
              the student's voice into text.
            </p>
          </div>

          <div className="item">
            <strong>
              03 · Learning context
            </strong>

            <p className="muted">
              ASCORA uses mastery, pace,
              scaffolding, visual support and
              known misconceptions.
            </p>
          </div>

          <div className="item">
            <strong>
              04 · Hugging Face AI
            </strong>

            <p className="muted">
              The doubt is sent to the backend
              AI provider for personalized teaching.
            </p>
          </div>

          <div className="item">
            <strong>
              05 · Personalized explanation
            </strong>

            <p className="muted">
              ASCORA receives an explanation
              adapted to the student's learning state.
            </p>
          </div>

          <div className="item">
            <strong>
              06 · Voice response
            </strong>

            <p className="muted">
              ASCORA speaks the generated
              explanation using text-to-speech.
            </p>
          </div>

          <div className="item">
            <strong>
              07 · Learning event
            </strong>

            <p className="muted">
              The completed doubt is recorded
              and the queue moves to the next student.
            </p>
          </div>

        </div>
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
              ASCORA receives assessment and
              interaction signals from the student.
            </p>
          </div>

          <div className="item">
            <strong>
              02 · Adapt
            </strong>

            <p className="muted">
              The teaching strategy changes based
              on mastery, errors and learning behaviour.
            </p>
          </div>

          <div className="item">
            <strong>
              03 · Teach
            </strong>

            <p className="muted">
              Hugging Face generates a personalized
              explanation using the student's context.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
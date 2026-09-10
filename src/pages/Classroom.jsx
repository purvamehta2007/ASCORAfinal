import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useVoice } from "../lib/useVoice";
import VisualLecture from "../components/VisualLecture";

export default function Classroom({ student }) {
  const {
    supported,
    listening,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    speak,
  } = useVoice();

  // ============================================================
  // CHAT STATE
  // ============================================================

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text:
        "Hi! I'm ASCORA. Today we'll work on linear equations using a visual, step-by-step approach.",
    },
  ]);

  const [text, setText] = useState("");
  const [state, setState] = useState("explaining");
  const [thinking, setThinking] = useState(false);

  // ============================================================
  // STUDENT / ADAPTIVE CONTEXT
  // ============================================================

  const [studentContext, setStudentContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);

  // ============================================================
  // LECTURE STATE
  // ============================================================

  const [lecture, setLecture] = useState(null);
  const [lectureStepIndex, setLectureStepIndex] = useState(0);

  const [lectureLoading, setLectureLoading] = useState(false);
  const [lectureError, setLectureError] = useState("");

  const [checkpointAnswer, setCheckpointAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  const [lectureMode, setLectureMode] = useState(false);

  // ============================================================
  // VOICE → TEXT SYNCHRONIZATION
  // ============================================================

  useEffect(() => {
    if (transcript) {
      setText(transcript);

      if (lectureMode) {
        setCheckpointAnswer(transcript);
      }
    }
  }, [transcript, lectureMode]);

  // ============================================================
  // ASCORA STATE
  // ============================================================

  useEffect(() => {
    if (listening) {
      setState("listening");
    }
  }, [listening]);

  // ============================================================
  // LOAD REAL STUDENT CONTEXT
  // ============================================================

  async function loadStudentContext() {
    if (!student?.id) {
      return null;
    }

    setContextLoading(true);

    try {
      const data = await apiFetch(
        `/api/ascora/student/${student.id}/context`
      );

      setStudentContext(data);

      return data;
    } catch (error) {
      console.error(
        "ASCORA student context error:",
        error
      );

      return null;
    } finally {
      setContextLoading(false);
    }
  }

  // Load context when student changes
  useEffect(() => {
    if (student?.id) {
      loadStudentContext();
    }
  }, [student?.id]);

  // ============================================================
  // NORMAL CHAT
  // ============================================================

  async function sendMessage(messageOverride = null) {
    const userMessage = (
      messageOverride ?? text
    ).trim();

    if (!userMessage || thinking) {
      return;
    }

    setText("");

    setMessages((messages) => [
      ...messages,
      {
        role: "me",
        text: userMessage,
      },
    ]);

    setThinking(true);
    setState("thinking");

    try {
      const response = await apiFetch(
        "/api/ascora/answer",
        {
          method: "POST",
          body: JSON.stringify({
            doubt: userMessage,
            topic:
              studentContext?.topic ||
              "Linear Equations",
          }),
        }
      );

      const reply =
        response?.answer ||
        "Let's work through this step by step.";

      setMessages((messages) => [
        ...messages,
        {
          role: "ai",
          text: reply,
        },
      ]);

      setState("speaking");
      speak(reply);
    } catch (error) {
      console.error(
        "ASCORA AI error:",
        error
      );

      const fallback =
        "Let's slow down and use a worked example. Imagine x + 5 = 12 as a balanced scale. If we remove 5 from one side, we remove 5 from the other side too. So x = 7.";

      setMessages((messages) => [
        ...messages,
        {
          role: "ai",
          text: fallback,
        },
      ]);

      setState("speaking");
      speak(fallback);
    } finally {
      setThinking(false);
    }
  }

  // ============================================================
  // VOICE CONTROL
  // ============================================================

  function handleVoice() {
    if (listening) {
      stopListening();
      return;
    }

    setText("");

    if (lectureMode) {
      setCheckpointAnswer("");
    }

    startListening();
  }

  // ============================================================
  // START ADAPTIVE LECTURE
  // ============================================================

  async function startAdaptiveLecture() {
    if (!student?.id) {
      setLectureError(
        "No student is currently signed in."
      );
      return;
    }

    setLectureLoading(true);
    setLectureError("");
    setEvaluation(null);
    setCheckpointAnswer("");
    setLectureStepIndex(0);
    setLectureMode(true);
    setState("thinking");

    try {
      // Get the latest trusted student context
      const context =
        await loadStudentContext();

      const topic =
        context?.topic ||
        "Linear Equations";

      const response = await apiFetch(
        "/api/ascora/lecture/generate",
        {
          method: "POST",
          body: JSON.stringify({
            studentId: student.id,
            topic,
            doubt:
              "Teach me this topic from the basics and help me understand it step by step.",
            objective:
              `Help me understand ${topic} and apply it correctly.`,
          }),
        }
      );

      if (!response?.lecture) {
        throw new Error(
          "Lecture was not generated."
        );
      }

      setLecture(response.lecture);

      setMessages((messages) => [
        ...messages,
        {
          role: "ai",
          text: `I've prepared a personalized lesson on ${topic} based on your learning profile.`,
        },
      ]);

      setState("speaking");

      // Speak the first lecture step
      const firstStep =
        response.lecture.steps?.[0];

      if (firstStep?.speech) {
        speak(firstStep.speech);
      }
    } catch (error) {
      console.error(
        "ASCORA lecture error:",
        error
      );

      setLectureError(
        error?.message ||
          "Unable to generate the lecture right now."
      );

      setLectureMode(false);
      setState("error");
    } finally {
      setLectureLoading(false);
    }
  }

  // ============================================================
  // CURRENT LECTURE STEP
  // ============================================================

  const currentLectureStep =
    lecture?.steps?.[lectureStepIndex] ||
    null;

  const isCheckpoint =
    currentLectureStep?.type ===
    "checkpoint";

  // ============================================================
  // MOVE TO NEXT LECTURE STEP
  // ============================================================

  function nextLectureStep() {
    if (!lecture?.steps?.length) {
      return;
    }

    if (
      lectureStepIndex >=
      lecture.steps.length - 1
    ) {
      setState("completed");
      return;
    }

    const nextIndex =
      lectureStepIndex + 1;

    const nextStep =
      lecture.steps[nextIndex];

    setLectureStepIndex(nextIndex);
    setEvaluation(null);
    setCheckpointAnswer("");

    if (
      nextStep?.type === "checkpoint"
    ) {
      setState("checkpoint");

      if (nextStep.speech) {
        speak(nextStep.speech);
      }

      return;
    }

    setState("speaking");

    if (nextStep?.speech) {
      speak(nextStep.speech);
    }
  }

  // ============================================================
  // EVALUATE CHECKPOINT
  // ============================================================

  async function evaluateCheckpoint() {
    if (
      !student?.id ||
      !lecture ||
      !currentLectureStep ||
      !checkpointAnswer.trim() ||
      evaluating
    ) {
      return;
    }

    setEvaluating(true);
    setState("evaluating");
    setLectureError("");

    try {
      const response =
        await apiFetch(
          "/api/ascora/lecture/evaluate",
          {
            method: "POST",
            body: JSON.stringify({
              studentId: student.id,

              topic:
                studentContext?.topic ||
                "Linear Equations",

              question:
                currentLectureStep.question,

              response:
                checkpointAnswer.trim(),

              expectedConcept:
                currentLectureStep.expectedConcept,

              priorMisconceptionType:
                lecture?.personalization
                  ?.misconception || null,
            }),
          }
        );

      setEvaluation(response);

      if (response.correct) {
        setState("correct");

        const feedback =
          response.feedback ||
          "Excellent. You understood the concept.";

        speak(feedback);
      } else {
        setState("needs_support");

        const feedback =
          response.feedback ||
          "Let's go through that idea once more.";

        speak(feedback);
      }
    } catch (error) {
      console.error(
        "Checkpoint evaluation error:",
        error
      );

      setLectureError(
        error?.message ||
          "Unable to evaluate the response."
      );

      setState("error");
    } finally {
      setEvaluating(false);
    }
  }

  // ============================================================
  // EXIT LECTURE
  // ============================================================

  function exitLecture() {
    setLectureMode(false);
    setLecture(null);
    setLectureStepIndex(0);
    setCheckpointAnswer("");
    setEvaluation(null);
    setLectureError("");
    setState("explaining");
  }

  // ============================================================
  // KEYBOARD HANDLING
  // ============================================================

  function handleKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (lectureMode && isCheckpoint) {
      evaluateCheckpoint();
      return;
    }

    sendMessage();
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div>
      {/* ======================================================
          TOP ACTION BAR
      ====================================================== */}

      <div
        className="card"
        style={{
          marginBottom: 20,
        }}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="pill">
              AI Classroom
            </span>

            <h1
              style={{
                marginTop: 8,
                marginBottom: 4,
              }}
            >
              Learn with ASCORA
            </h1>

            <p className="muted">
              Personalized teaching based on
              your learning profile.
            </p>
          </div>

          {!lectureMode && (
            <button
              className="btn"
              onClick={startAdaptiveLecture}
              disabled={
                lectureLoading ||
                contextLoading ||
                !student?.id
              }
            >
              {lectureLoading
                ? "Preparing Lecture..."
                : "📚 Start Adaptive Lecture"}
            </button>
          )}

          {lectureMode && (
            <button
              className="btn secondary"
              onClick={exitLecture}
            >
              Exit Lecture
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          ADAPTIVE CONTEXT
      ====================================================== */}

      {studentContext && !lectureMode && (
        <div
          className="card"
          style={{
            marginBottom: 20,
          }}
        >
          <h3>
            🧠 Your ASCORA Learning Context
          </h3>

          <div
            className="row"
            style={{
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <span className="pill">
              Topic:{" "}
              {studentContext.topic ||
                "Current topic"}
            </span>

            <span className="pill">
              Mastery:{" "}
              {studentContext.mastery !==
              null &&
              studentContext.mastery !==
                undefined
                ? `${Math.round(
                    Number(
                      studentContext.mastery
                    ) * 100
                  )}%`
                : "Learning"}
            </span>

            <span className="pill">
              Pace:{" "}
              {studentContext.adaptiveStrategy
                ?.pace ||
                studentContext.strategy
                  ?.pace ||
                "adaptive"}
            </span>

            <span className="pill">
              Visual support:{" "}
              {studentContext.adaptiveStrategy
                ?.visualSupport ??
              studentContext.strategy?.visual
                ? "on"
                : "off"}
            </span>
          </div>
        </div>
      )}

      {/* ======================================================
          LECTURE MODE
      ====================================================== */}

      {lectureMode && (
        <div
          className="card"
          style={{
            marginBottom: 20,
          }}
        >
          {lectureLoading && (
            <div
              style={{
                textAlign: "center",
                padding: 40,
              }}
            >
              <h2>
                🧠 ASCORA is preparing your
                lesson...
              </h2>

              <p className="muted">
                Analyzing your learning profile
                and adapting the teaching strategy.
              </p>
            </div>
          )}

          {lecture && !lectureLoading && (
            <>
              {/* Lecture header */}

              <div
                style={{
                  marginBottom: 24,
                }}
              >
                <span className="pill">
                  Adaptive Lecture
                </span>

                <h2
                  style={{
                    marginTop: 10,
                  }}
                >
                  {lecture.title}
                </h2>

                <p className="muted">
                  {lecture.objective}
                </p>

                <div
                  className="row"
                  style={{
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="pill">
                    Difficulty:{" "}
                    {lecture.strategy
                      ?.difficulty ||
                      "adaptive"}
                  </span>

                  <span className="pill">
                    Pace:{" "}
                    {lecture.strategy?.pace ||
                      "adaptive"}
                  </span>

                  <span className="pill">
                    Scaffolding:{" "}
                    {lecture.strategy
                      ?.scaffolding ||
                      "adaptive"}
                  </span>

                  {lecture.personalization
                    ?.misconception && (
                    <span className="pill">
                      Targeted remediation
                    </span>
                  )}
                </div>
              </div>

              {/* Progress */}

              <div
                style={{
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span className="muted">
                    Lesson progress
                  </span>

                  <span className="muted">
                    Step{" "}
                    {lectureStepIndex + 1} of{" "}
                    {lecture.steps.length}
                  </span>
                </div>

                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background:
                      "rgba(128,128,128,0.2)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${
                        ((lectureStepIndex +
                          1) /
                          lecture.steps
                            .length) *
                        100
                      }%`,
                      background:
                        "currentColor",
                      transition:
                        "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Step information */}

              {currentLectureStep && (
                <div>
                  <div
                    className="card"
                    style={{
                      marginBottom: 20,
                    }}
                  >
                    <span className="pill">
                      {currentLectureStep.type}
                    </span>

                    <p
                      style={{
                        marginTop: 16,
                        fontSize: 18,
                        lineHeight: 1.7,
                      }}
                    >
                      {currentLectureStep.speech}
                    </p>
                  </div>

                  {/* Visual */}

                  {currentLectureStep.visual && (
                    <div
                      style={{
                        marginBottom: 20,
                      }}
                    >
                      <VisualLecture
                        visual={
                          currentLectureStep.visual
                        }
                      />
                    </div>
                  )}

                  {/* Checkpoint */}

                  {isCheckpoint && (
                    <div
                      className="card"
                      style={{
                        marginBottom: 20,
                      }}
                    >
                      <h3>
                        🧩 Checkpoint
                      </h3>

                      <p
                        style={{
                          marginTop: 10,
                          fontSize: 18,
                        }}
                      >
                        {
                          currentLectureStep.question
                        }
                      </p>

                      <div
                        className="row"
                        style={{
                          marginTop: 16,
                        }}
                      >
                        <input
                          value={
                            checkpointAnswer
                          }
                          onChange={(event) =>
                            setCheckpointAnswer(
                              event.target.value
                            )
                          }
                          onKeyDown={
                            handleKeyDown
                          }
                          placeholder="Type your answer..."
                          disabled={
                            evaluating
                          }
                        />

                        <button
                          className={`btn ${
                            listening
                              ? "danger"
                              : ""
                          }`}
                          onClick={
                            handleVoice
                          }
                          disabled={
                            !supported ||
                            evaluating
                          }
                        >
                          {listening
                            ? "🎤 Stop"
                            : "🎤 Answer"}
                        </button>

                        <button
                          className="btn"
                          onClick={
                            evaluateCheckpoint
                          }
                          disabled={
                            evaluating ||
                            !checkpointAnswer.trim()
                          }
                        >
                          {evaluating
                            ? "Evaluating..."
                            : "Submit Answer"}
                        </button>
                      </div>

                      {evaluation && (
                        <div
                          className="item"
                          style={{
                            marginTop: 16,
                          }}
                        >
                          <strong>
                            {evaluation.correct
                              ? "✅ Correct"
                              : "💡 Let's improve this"}
                          </strong>

                          {evaluation.feedback && (
                            <p
                              style={{
                                marginTop: 6,
                              }}
                            >
                              {
                                evaluation.feedback
                              }
                            </p>
                          )}

                          {evaluation.adaptation && (
                            <p
                              className="muted"
                              style={{
                                marginTop: 6,
                              }}
                            >
                              ASCORA will adapt
                              the next learning
                              step:
                              {" "}
                              {
                                evaluation.adaptation
                              }
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Next button */}

                  {!isCheckpoint && (
                    <div
                      className="row"
                      style={{
                        justifyContent:
                          "flex-end",
                      }}
                    >
                      <button
                        className="btn"
                        onClick={
                          nextLectureStep
                        }
                      >
                        {lectureStepIndex >=
                        lecture.steps.length - 1
                          ? "Finish Lecture"
                          : "Next Step →"}
                      </button>
                    </div>
                  )}

                  {isCheckpoint &&
                    evaluation && (
                      <div
                        className="row"
                        style={{
                          justifyContent:
                            "flex-end",
                        }}
                      >
                        <button
                          className="btn"
                          onClick={
                            nextLectureStep
                          }
                        >
                          Continue Lesson →
                        </button>
                      </div>
                    )}
                </div>
              )}

              {/* Completed */}

              {state === "completed" && (
                <div
                  className="card"
                  style={{
                    textAlign: "center",
                    marginTop: 20,
                  }}
                >
                  <h2>
                    🎉 Lecture Complete
                  </h2>

                  <p
                    className="muted"
                    style={{
                      marginTop: 8,
                    }}
                  >
                    ASCORA has recorded your
                    learning signal and can use
                    it to personalize future
                    teaching.
                  </p>

                  <button
                    className="btn"
                    style={{
                      marginTop: 16,
                    }}
                    onClick={exitLecture}
                  >
                    Back to Classroom
                  </button>
                </div>
              )}
            </>
          )}

          {lectureError && (
            <div
              className="item"
              style={{
                marginTop: 16,
                color: "#f87171",
              }}
            >
              {lectureError}
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          NORMAL CLASSROOM
      ====================================================== */}

      {!lectureMode && (
        <div className="grid grid-2">
          {/* ASCORA */}

          <div
            className="card"
            style={{
              textAlign: "center",
            }}
          >
            <div
              className={`avatar ${
                listening
                  ? "listening"
                  : ""
              }`}
            >
              ✦
            </div>

            <h2>ASCORA</h2>

            <span className="pill">
              {listening
                ? "listening"
                : thinking
                ? "thinking"
                : state}
            </span>

            <p
              className="muted"
              style={{
                marginTop: 12,
              }}
            >
              Adaptive teaching assistant
            </p>

            <div
              className="row"
              style={{
                justifyContent: "center",
              }}
            >
              <button
                className={`btn ${
                  listening
                    ? "danger"
                    : ""
                }`}
                onClick={handleVoice}
                disabled={!supported}
              >
                {listening
                  ? "🎤 Stop Listening"
                  : "🎤 Talk to ASCORA"}
              </button>

              <button
                className="btn secondary"
                onClick={() => {
                  const demo =
                    "Let's solve x plus 5 equals 12 step by step.";

                  setMessages(
                    (messages) => [
                      ...messages,
                      {
                        role: "ai",
                        text: demo,
                      },
                    ]
                  );

                  setState("speaking");
                  speak(demo);
                }}
              >
                🔊 Speak
              </button>
            </div>

            {!supported && (
              <p
                style={{
                  color: "#f87171",
                  marginTop: 12,
                }}
              >
                Speech recognition is not
                supported in this browser.
              </p>
            )}

            {voiceError && (
              <p
                style={{
                  color: "#f87171",
                  marginTop: 12,
                }}
              >
                {voiceError}
              </p>
            )}
          </div>

          {/* CHAT */}

          <div className="card">
            <h2>AI Classroom</h2>

            <div className="chat">
              {messages.map(
                (message, index) => (
                  <div
                    key={index}
                    className={`bubble ${
                      message.role ===
                      "me"
                        ? "me"
                        : ""
                    }`}
                  >
                    {message.text}
                  </div>
                )
              )}
            </div>

            {listening && (
              <div
                className="item"
                style={{
                  marginBottom: 12,
                }}
              >
                🎤 Listening...

                {transcript && (
                  <div
                    style={{
                      marginTop: 6,
                    }}
                  >
                    <strong>
                      {transcript}
                    </strong>
                  </div>
                )}
              </div>
            )}

            <div className="row">
              <input
                value={text}
                onChange={(event) =>
                  setText(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder="Ask ASCORA something..."
              />

              <button
                className="btn"
                onClick={() =>
                  sendMessage()
                }
                disabled={
                  thinking ||
                  !text.trim()
                }
              >
                {thinking
                  ? "Thinking..."
                  : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
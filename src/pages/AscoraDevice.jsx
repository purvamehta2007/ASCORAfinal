import React, { useEffect, useRef, useState } from "react";
import VisualLecture from "../components/VisualLecture";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

export default function AscoraDevice() {
  const [scheduleItem, setScheduleItem] = useState(null);
  const [isLive, setIsLive] = useState(false);

  const [lecture, setLecture] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [error, setError] = useState("");

  const previousStateRef = useRef("");
  const speechRef = useRef(null);

  // --------------------------------------------------
  // Speak
  // --------------------------------------------------

  function speak(text) {
    if (!text) return;

    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    speechRef.current = utterance;

    window.speechSynthesis.speak(
      utterance
    );
  }

  // --------------------------------------------------
  // Load lesson
  // --------------------------------------------------

  async function loadLesson(item) {
    if (!item?.id) return;

    try {
      setLessonLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/device/lesson`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            scheduleItemId: item.id,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to generate lesson"
        );
      }

      setLecture(
        data?.lecture || null
      );

      setStepIndex(0);

      const firstStep =
        data?.lecture?.steps?.[0];

      if (firstStep?.speech) {
        speak(firstStep.speech);
      }
    } catch (err) {
      console.error(
        "Device lesson error:",
        err
      );

      setError(
        err?.message ||
          "Unable to load lesson"
      );
    } finally {
      setLessonLoading(false);
    }
  }

  // --------------------------------------------------
  // Check schedule
  // --------------------------------------------------

  async function checkSchedule() {
    try {
      const response = await fetch(
        `${API_URL}/api/device/current`,
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to load schedule"
        );
      }

      const item =
        data?.item || null;

      const live =
        Boolean(data?.live);

      setScheduleItem(item);
      setIsLive(live);
      setLoading(false);

      // ----------------------------------------------
      // Detect state change
      // ----------------------------------------------

      const stateKey =
        `${item?.id || "none"}:${live}`;

      if (
        stateKey !==
        previousStateRef.current
      ) {
        previousStateRef.current =
          stateKey;

        // --------------------------------------------
        // Lesson has just become live
        // --------------------------------------------

        if (
          live &&
          item?.item_type === "lesson"
        ) {
          setLecture(null);
          setStepIndex(0);

          await loadLesson(item);
        }

        // --------------------------------------------
        // Upcoming / no longer live
        // --------------------------------------------

        if (!live) {
          setLecture(null);
          setStepIndex(0);

          if (
            window.speechSynthesis
          ) {
            window.speechSynthesis.cancel();
          }
        }
      }
    } catch (err) {
      console.error(
        "Device schedule error:",
        err
      );

      setLoading(false);

      setError(
        err?.message ||
          "ASCORA cannot connect to server"
      );
    }
  }

  // --------------------------------------------------
  // Poll schedule
  // --------------------------------------------------

  useEffect(() => {
    checkSchedule();

    const interval =
      setInterval(
        checkSchedule,
        15000
      );

    return () => {
      clearInterval(interval);

      if (
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // --------------------------------------------------
  // Speak lecture steps
  // --------------------------------------------------

  useEffect(() => {
    if (!isLive) return;

    if (!lecture?.steps?.length)
      return;

    const step =
      lecture.steps[stepIndex];

    if (!step?.speech) return;

    // First step is already spoken
    // when lesson is loaded.
    if (stepIndex === 0) return;

    speak(step.speech);
  }, [
    stepIndex,
    lecture,
    isLive,
  ]);

  // --------------------------------------------------
  // Automatically advance lecture
  // --------------------------------------------------

  useEffect(() => {
    if (!isLive) return;

    if (!lecture?.steps?.length)
      return;

    const step =
      lecture.steps[stepIndex];

    if (!step) return;

    const speech =
      step.speech || "";

    const duration =
      Math.max(
        5000,
        speech.length * 55
      );

    const timer =
      setTimeout(() => {
        if (
          stepIndex <
          lecture.steps.length - 1
        ) {
          setStepIndex(
            (current) =>
              current + 1
          );
        }
      }, duration);

    return () =>
      clearTimeout(timer);
  }, [
    lecture,
    stepIndex,
    isLive,
  ]);

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div style={styles.screen}>
        <div style={styles.robot}>
          🤖
        </div>

        <h1 style={styles.title}>
          ASCORA
        </h1>

        <p style={styles.subtitle}>
          Connecting to learning system...
        </p>
      </div>
    );
  }

  // --------------------------------------------------
  // Main device screen
  // --------------------------------------------------

  return (
    <div style={styles.screen}>
      {/* Robot */}

      <div style={styles.robotContainer}>
        <div style={styles.robot}>
          {isLive ? "🤖" : "🙂"}
        </div>

        <div
          style={{
            ...styles.status,

            background: isLive
              ? "#DCE7E1"
              : "#EFEBE1",

            color: isLive
              ? "#4F7869"
              : "#6B7280",
          }}
        >
          <span style={styles.dot}>
            ●
          </span>

          {isLive
            ? "ASCORA IS TEACHING"
            : "ASCORA IS READY"}
        </div>
      </div>

      {/* Topic */}

      <div style={styles.card}>
        <div style={styles.label}>
          {isLive
            ? "CURRENT LESSON"
            : "NEXT ON SCHEDULE"}
        </div>

        <h1 style={styles.topic}>
          {scheduleItem?.topic ||
            scheduleItem?.title ||
            "No lesson scheduled"}
        </h1>

        {scheduleItem && (
          <p style={styles.time}>
            {scheduleItem.start_time?.slice(
              0,
              5
            )}{" "}
            –{" "}
            {scheduleItem.end_time?.slice(
              0,
              5
            )}
          </p>
        )}
      </div>

      {/* Lesson */}

      {lessonLoading && (
        <div style={styles.message}>
          <div style={styles.spinner}>
            ✦
          </div>

          <p>
            ASCORA is preparing your
            personalized lesson...
          </p>
        </div>
      )}

      {!lessonLoading &&
        isLive &&
        lecture && (
          <div style={styles.lessonCard}>
            <div style={styles.label}>
              TEACHING
            </div>

            <h2 style={styles.lessonTitle}>
              {lecture.title ||
                scheduleItem?.topic}
            </h2>

            {lecture.steps?.[
              stepIndex
            ] && (
              <div style={styles.step}>
                {lecture.steps[
                  stepIndex
                ].title && (
                  <h3
                    style={
                      styles.stepTitle
                    }
                  >
                    {
                      lecture.steps[
                        stepIndex
                      ].title
                    }
                  </h3>
                )}

                <p style={styles.speech}>
                  {
                    lecture.steps[
                      stepIndex
                    ].speech
                  }
                </p>
              </div>
            )}

            <div style={styles.progress}>
              Step{" "}
              {stepIndex + 1} of{" "}
              {lecture.steps?.length ||
                1}
            </div>

            <VisualLecture
              lecture={lecture}
            />
          </div>
        )}

      {/* Waiting */}

      {!lessonLoading &&
        !isLive && (
          <div style={styles.message}>
            <div style={styles.waitIcon}>
              ◷
            </div>

            <h2>
              Waiting for the next
              lesson
            </h2>

            <p>
              ASCORA will automatically
              start teaching when the
              scheduled time begins.
            </p>
          </div>
        )}

      {/* Error */}

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Footer */}

      <div style={styles.footer}>
        ASCORA • Adaptive Learning
        Device
      </div>
    </div>
  );
}

// --------------------------------------------------
// Styles
// --------------------------------------------------

const styles = {
  screen: {
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",

    background: "#F6F3EC",
    color: "#1C2321",

    display: "flex",
    flexDirection: "column",
    alignItems: "center",

    padding: "40px 24px",

    fontFamily:
      "'Inter', system-ui, sans-serif",
  },

  robotContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",

    marginBottom: 24,
  },

  robot: {
    width: 130,
    height: 130,

    borderRadius: "50%",

    background: "#1C2321",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    fontSize: 64,

    boxShadow:
      "0 12px 35px rgba(28,35,33,.18)",
  },

  status: {
    marginTop: -10,

    padding:
      "7px 14px",

    borderRadius: 999,

    fontSize: 11,
    fontWeight: 800,

    letterSpacing: ".08em",
  },

  dot: {
    marginRight: 6,
  },

  title: {
    fontFamily:
      "'Fraunces', Georgia, serif",

    fontSize: 42,

    margin:
      "0 0 6px",
  },

  subtitle: {
    color: "#6B7280",

    marginTop: 0,
  },

  card: {
    width: "100%",
    maxWidth: 760,

    boxSizing: "border-box",

    background: "#FFFFFF",

    border:
      "1px solid #DAD4C4",

    borderRadius: 20,

    padding: 28,

    textAlign: "center",

    marginBottom: 20,
  },

  label: {
    fontSize: 11,

    fontWeight: 800,

    letterSpacing: ".12em",

    color: "#6B7280",

    marginBottom: 10,
  },

  topic: {
    fontFamily:
      "'Fraunces', Georgia, serif",

    fontSize: 34,

    margin:
      "0 0 8px",
  },

  time: {
    color: "#6B7280",

    fontSize: 14,

    margin: 0,
  },

  lessonCard: {
    width: "100%",
    maxWidth: 760,

    boxSizing: "border-box",

    background: "#FFFFFF",

    border:
      "1px solid #DAD4C4",

    borderRadius: 20,

    padding: 30,

    marginBottom: 20,
  },

  lessonTitle: {
    fontFamily:
      "'Fraunces', Georgia, serif",

    fontSize: 30,

    margin:
      "0 0 22px",
  },

  step: {
    background: "#DCE7E1",

    borderRadius: 16,

    padding: 22,

    marginBottom: 16,
  },

  stepTitle: {
    margin:
      "0 0 10px",

    fontSize: 20,
  },

  speech: {
    margin: 0,

    fontSize: 20,

    lineHeight: 1.6,
  },

  progress: {
    color: "#6B7280",

    fontSize: 12,

    fontWeight: 700,

    marginBottom: 20,
  },

  message: {
    width: "100%",
    maxWidth: 600,

    textAlign: "center",

    padding: 35,

    color: "#6B7280",
  },

  spinner: {
    fontSize: 40,

    marginBottom: 12,

    color: "#4F7869",
  },

  waitIcon: {
    fontSize: 50,

    marginBottom: 10,

    color: "#C98A3A",
  },

  error: {
    width: "100%",
    maxWidth: 700,

    boxSizing: "border-box",

    background: "#F3E2C6",

    color: "#B4552F",

    padding: 14,

    borderRadius: 12,

    marginTop: 10,

    textAlign: "center",

    fontSize: 14,
  },

  footer: {
    marginTop: "auto",

    paddingTop: 30,

    color: "#6B7280",

    fontSize: 12,

    letterSpacing: ".04em",
  },
};
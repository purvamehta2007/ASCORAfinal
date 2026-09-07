import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useVoice } from "../lib/useVoice";

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

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text:
        "Hi! I'm ASCORA. Today we'll work on linear equations using a visual, step-by-step approach.",
    },
  ]);

  const [text, setText] = useState("");
  const [state, setState] = useState("explaining");
  const [strategy] = useState("Visual + guided questions");
  const [thinking, setThinking] = useState(false);

  // Keep the text box synchronized with voice transcription
  useEffect(() => {
    if (transcript) {
      setText(transcript);
    }
  }, [transcript]);

  // Update ASCORA state while listening
  useEffect(() => {
    if (listening) {
      setState("listening");
    }
  }, [listening]);

  async function sendMessage(messageOverride = null) {
    const userMessage = (messageOverride ?? text).trim();

    if (!userMessage || thinking) return;

    // Clear input
    setText("");

    // Add student's message to chat
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
      // Send message to ASCORA backend
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          student_id: student?.id,

          message: userMessage,

          context: {
            topic: "Linear Equations",

            mastery: 0.43,

            misconceptions: [
              "incorrect_inverse_operation",
            ],

            strategy,

            language: student?.language || "English",
          },
        }),
      });

      const reply =
        response?.reply ||
        "Let's work through this step by step.";

      // Add ASCORA response
      setMessages((messages) => [
        ...messages,
        {
          role: "ai",
          text: reply,
        },
      ]);

      // Speak response
      setState("speaking");
      speak(reply);
    } catch (error) {
      console.error("ASCORA AI error:", error);

      // Keep classroom usable even if backend is unavailable
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

  function handleVoice() {
    if (listening) {
      stopListening();
      return;
    }

    setText("");
    startListening();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
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
            listening ? "listening" : ""
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
          Strategy: {strategy}
        </p>

        <div
          className="row"
          style={{
            justifyContent: "center",
          }}
        >
          <button
            className={`btn ${
              listening ? "danger" : ""
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

              setMessages((messages) => [
                ...messages,
                {
                  role: "ai",
                  text: demo,
                },
              ]);

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
            Speech recognition is not supported in
            this browser.
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

      {/* AI CLASSROOM */}
      <div className="card">
        <h2>AI Classroom</h2>

        <div className="chat">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`bubble ${
                message.role === "me" ? "me" : ""
              }`}
            >
              {message.text}
            </div>
          ))}
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
                <strong>{transcript}</strong>
              </div>
            )}
          </div>
        )}

        <div className="row">
          <input
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Ask ASCORA something..."
          />

          <button
            className="btn"
            onClick={() => sendMessage()}
            disabled={thinking || !text.trim()}
          >
            {thinking ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}


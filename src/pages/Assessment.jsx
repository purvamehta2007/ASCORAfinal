import React, { useState } from "react";
import { apiFetch } from "../lib/api";

const questions = [
  {
    id: "q1",
    topic: "Linear Equations",
    concept: "inverse_operations",
    difficulty: 2,
    text: "Solve x + 5 = 12.",
    answer: "7",
  },
  {
    id: "q2",
    topic: "Fractions",
    concept: "equivalent_fractions",
    difficulty: 1,
    text: "What fraction is equivalent to 1/2?",
    answer: "2/4",
  },
  {
    id: "q3",
    topic: "Geometry",
    concept: "triangle_angles",
    difficulty: 2,
    text: "The angles of a triangle sum to how many degrees?",
    answer: "180",
  },
];

export default function Assessment({ student }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);
  const [started, setStarted] = useState(Date.now());
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const question = questions[currentIndex];

  async function submit() {
    if (!value.trim() || submitting || !question) {
      return;
    }

    const correct =
      value.trim().toLowerCase() ===
      question.answer.toLowerCase();

    if (correct) {
      setScore((previousScore) => previousScore + 1);
    }

    setSubmitting(true);

    try {
      await apiFetch("/api/assessment/attempt", {
        method: "POST",
        body: JSON.stringify({
          question_id: question.id,

          topic: question.topic,

          concept: question.concept,

          difficulty: question.difficulty,

          answer: value,

          correct,

          time_taken: Math.round(
            (Date.now() - started) / 1000
          ),

          attempts: 1,

          hints_used: 0,

          answer_changed: false,

          question: question.text,
        }),
      });

      setResult(
        correct
          ? "Correct!"
          : "Not quite — ASCORA will use this error as a learning signal."
      );
    } catch (error) {
      console.error(
        "Assessment submission error:",
        error
      );

      // The assessment can still continue even if
      // the backend is temporarily unavailable.
      setResult(
        correct
          ? "Correct!"
          : "Not quite — ASCORA will use this error as a learning signal."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    setResult(null);
    setValue("");
    setStarted(Date.now());
    setCurrentIndex(
      (previousIndex) => previousIndex + 1
    );
  }

  function retakeAssessment() {
    setCurrentIndex(0);
    setValue("");
    setResult(null);
    setScore(0);
    setStarted(Date.now());
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (result) {
        nextQuestion();
      } else {
        submit();
      }
    }
  }

  // ==========================================
  // COMPLETION SCREEN
  // ==========================================

  if (currentIndex >= questions.length) {
    return (
      <div className="hero">
        <span className="pill">
          Diagnostic complete
        </span>

        <h1>
          {score}/{questions.length}
        </h1>

        <p>
          Your performance has been recorded for
          adaptive analysis.
        </p>

        <button
          className="btn"
          onClick={retakeAssessment}
        >
          Retake
        </button>
      </div>
    );
  }

  // ==========================================
  // ASSESSMENT SCREEN
  // ==========================================

  return (
    <div className="grid grid-2">
      {/* QUESTION */}
      <div className="card">
        <span className="pill">
          Question {currentIndex + 1}/
          {questions.length}
        </span>

        <h1>{question.text}</h1>

        <label>
          Your answer

          <input
            value={value}
            onChange={(event) =>
              setValue(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={submitting || !!result}
          />
        </label>

        <div
          className="row"
          style={{
            marginTop: 14,
          }}
        >
          {!result ? (
            <button
              className="btn"
              onClick={submit}
              disabled={
                submitting || !value.trim()
              }
            >
              {submitting
                ? "Recording..."
                : "Submit"}
            </button>
          ) : (
            <button
              className="btn secondary"
              onClick={nextQuestion}
            >
              {currentIndex ===
              questions.length - 1
                ? "Finish"
                : "Next"}
            </button>
          )}
        </div>

        {result && (
          <p
            style={{
              marginTop: 16,
            }}
          >
            {result}
          </p>
        )}
      </div>

      {/* DATA COLLECTION */}
      <div className="card">
        <h2>What we collect</h2>

        <div className="list">
          <div className="item">
            Accuracy
          </div>

          <div className="item">
            Response time
          </div>

          <div className="item">
            Attempts and hints
          </div>

          <div className="item">
            Concept + difficulty
          </div>

          <div className="item">
            Error signals
          </div>
        </div>

        <p
          className="muted"
          style={{
            marginTop: 16,
          }}
        >
          These signals help ASCORA understand
          how you learn and where you need
          support.
        </p>
      </div>
    </div>
  );
}


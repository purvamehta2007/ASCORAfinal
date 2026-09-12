import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  GraduationCap,
  RotateCcw,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";

const DEMO_QUESTIONS = [
  {
    id: "q1",
    question: "What is photosynthesis?",
    options: [
      "The process by which plants make food using light",
      "The process by which plants absorb oxygen",
      "The process by which plants produce soil",
      "The process by which plants lose water",
    ],
    correctAnswer: "The process by which plants make food using light",
    topic: "Biology",
    concept: "Photosynthesis",
    difficulty: 1,
  },
  {
    id: "q2",
    question: "Which gas is mainly used by plants during photosynthesis?",
    options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
    correctAnswer: "Carbon dioxide",
    topic: "Biology",
    concept: "Photosynthesis",
    difficulty: 1,
  },
  {
    id: "q3",
    question: "What is the main function of chlorophyll?",
    options: [
      "Absorb light energy",
      "Absorb water",
      "Produce oxygen directly",
      "Store soil nutrients",
    ],
    correctAnswer: "Absorb light energy",
    topic: "Biology",
    concept: "Chlorophyll",
    difficulty: 2,
  },
];

const testCss = `
  .test-option {
    width: 100%;
    text-align: left;
    border-radius: 16px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    border: 1px solid rgba(148,163,184,.14);
    background: rgba(255,255,255,.02);
    color: #f4f7fb;
    transition:
      border-color .15s ease,
      background .15s ease,
      transform .1s ease;
  }

  .test-option:hover {
    background: rgba(56,189,248,.05);
    border-color: rgba(56,189,248,.2);
  }

  .test-option.selected {
    border-color: #38bdf8;
    background: rgba(56,189,248,.08);
  }

  .test-option:active {
    transform: scale(.995);
  }

  .test-letter {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: rgba(148,163,184,.08);
    font-weight: 700;
    font-size: 13px;
    color: #94a3b8;
  }

  .test-option.selected .test-letter {
    background: #38bdf8;
    color: #04101d;
  }

  .test-progress-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(148,163,184,.12);
    overflow: hidden;
  }

  .test-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg,#38bdf8,#8b5cf6);
    transition: width .4s ease;
  }

  .topic-bar-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(148,163,184,.10);
    overflow: hidden;
  }

  .topic-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width .6s ease;
  }
`;

export default function Test({ user: userProp }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(userProp || null);
  const [questions] = useState(DEMO_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        navigate("/auth");
        return;
      }

      setUser(currentUser);
    };

    if (!userProp) {
      loadUser();
    }
  }, [userProp, navigate]);

  const currentQuestion = questions[currentIndex];

  const progress = useMemo(
    () => ((currentIndex + 1) / questions.length) * 100,
    [currentIndex, questions.length]
  );

  const submitCurrentAnswer = async () => {
    if (!selectedAnswer) {
      setError("Please select an answer.");
      return;
    }

    if (!user) {
      setError("You are not logged in.");
      return;
    }

    setError("");
    setLoading(true);

    const timeTaken = Math.max(
      1,
      Math.round((Date.now() - questionStartTime) / 1000)
    );

    const correct =
      selectedAnswer === currentQuestion.correctAnswer;

    const attempt = {
      question_id: currentQuestion.id,
      topic: currentQuestion.topic,
      concept: currentQuestion.concept,
      difficulty: currentQuestion.difficulty,
      answer: selectedAnswer,
      correct,
      time_taken: timeTaken,
      attempts: 1,
      hints_used: 0,
      answer_changed: false,
      question: currentQuestion.question,
    };

    try {
      // Demo mode:
      // Save answer locally for this test session.
      setAnswers((previous) => [
        ...previous,
        {
          ...attempt,
          misconception: null,
        },
      ]);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex((previous) => previous + 1);
        setSelectedAnswer("");
        setQuestionStartTime(Date.now());
      } else {
        setFinished(true);
      }
    } catch (err) {
      console.error("ASSESSMENT ERROR:", err);
      setError(
        err?.message || "Could not process your answer."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * =========================================================
   * PERFORMANCE BREAKDOWN
   * =========================================================
   */

  const performance = useMemo(() => {
    if (!answers.length) {
      return null;
    }

    const totalCorrect = answers.filter(
      (a) => a.correct
    ).length;

    const totalTime = answers.reduce(
      (sum, a) => sum + (a.time_taken || 0),
      0
    );

    const accuracy = Math.round(
      (totalCorrect / answers.length) * 100
    );

    const byTopic = {};

    answers.forEach((a) => {
      const key = a.topic || "General";

      if (!byTopic[key]) {
        byTopic[key] = {
          total: 0,
          correct: 0,
          time: 0,
        };
      }

      byTopic[key].total += 1;
      byTopic[key].time += a.time_taken || 0;

      if (a.correct) {
        byTopic[key].correct += 1;
      }
    });

    const topics = Object.entries(byTopic)
      .map(([topic, stats]) => ({
        topic,
        accuracy: Math.round(
          (stats.correct / stats.total) * 100
        ),
        total: stats.total,
        correct: stats.correct,
        avgTime: Math.round(
          stats.time / stats.total
        ),
      }))
      .sort(
        (a, b) => b.accuracy - a.accuracy
      );

    const misconceptions = answers
      .filter((a) => a.misconception)
      .map((a) => ({
        concept: a.concept,
        ...a.misconception,
      }));

    const weakest = topics.filter(
      (t) => t.accuracy < 70
    );

    let verdict = "Strong performance";

    if (accuracy < 40) {
      verdict = "Needs focused practice";
    } else if (accuracy < 70) {
      verdict = "Good progress, some gaps";
    }

    return {
      totalCorrect,
      totalTime,
      accuracy,
      avgTimePerQuestion: Math.round(
        totalTime / answers.length
      ),
      topics,
      misconceptions,
      weakest,
      verdict,
    };
  }, [answers]);

  /*
   * =========================================================
   * RESULTS SCREEN
   * =========================================================
   */

  if (finished && performance) {
    const ringColor =
      performance.accuracy >= 70
        ? C.green
        : performance.accuracy >= 40
        ? C.amber
        : C.red;

    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "48px 20px",
        }}
      >
        <style>{testCss}</style>

        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          {/* HEADER */}

          <div
            style={{
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 18px",
                borderRadius: 20,
                display: "grid",
                placeItems: "center",
                background: C.cyanSoft,
                border: `1px solid ${C.border}`,
              }}
            >
              <GraduationCap
                size={28}
                color="#7dd3fc"
              />
            </div>

            <h1
              style={{
                fontSize: 30,
                marginBottom: 8,
              }}
            >
              Assessment Complete
            </h1>

            <p
              style={{
                color: C.muted,
                fontSize: 14.5,
              }}
            >
              {performance.verdict}
            </p>
          </div>

          {/* SCORE + TIME SUMMARY */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 28,
              alignItems: "center",
              borderRadius: 24,
              border: `1px solid ${C.border}`,
              background: C.panel,
              backdropFilter: "blur(18px)",
              padding: "28px 30px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: `conic-gradient(
                  ${ringColor}
                  ${performance.accuracy * 3.6}deg,
                  rgba(148,163,184,.12) 0deg
                )`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "#0b1220",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    fontFamily:
                      "var(--font-display)",
                  }}
                >
                  {performance.accuracy}%
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(90px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    color: C.muted,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Score
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 750,
                  }}
                >
                  {performance.totalCorrect}/
                  {questions.length}
                </div>
              </div>

              <div>
                <div
                  style={{
                    color: C.muted,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Total time
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 750,
                  }}
                >
                  {performance.totalTime}s
                </div>
              </div>

              <div>
                <div
                  style={{
                    color: C.muted,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Avg / question
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 750,
                  }}
                >
                  {performance.avgTimePerQuestion}s
                </div>
              </div>
            </div>
          </div>

          {/* TOPIC BREAKDOWN */}

          <div
            style={{
              borderRadius: 24,
              border: `1px solid ${C.border}`,
              background: C.panel,
              backdropFilter: "blur(18px)",
              padding: "26px 28px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 18,
              }}
            >
              <TrendingUp
                size={16}
                color="#7dd3fc"
              />

              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Performance by topic
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gap: 16,
              }}
            >
              {performance.topics.map((t) => (
                <div key={t.topic}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      marginBottom: 7,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                      }}
                    >
                      {t.topic}
                    </span>

                    <span
                      style={{
                        fontSize: 12.5,
                        color: C.muted,
                      }}
                    >
                      {t.correct}/{t.total} correct ·
                      avg {t.avgTime}s
                    </span>
                  </div>

                  <div className="topic-bar-track">
                    <div
                      className="topic-bar-fill"
                      style={{
                        width: `${t.accuracy}%`,
                        background:
                          t.accuracy >= 70
                            ? "linear-gradient(90deg,#34d399,#10b981)"
                            : t.accuracy >= 40
                            ? "linear-gradient(90deg,#f5a524,#f59e0b)"
                            : "linear-gradient(90deg,#f87171,#ef4444)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MISCONCEPTIONS */}

          {performance.misconceptions.length >
            0 && (
            <div
              style={{
                borderRadius: 24,
                border: `1px solid ${C.amber}33`,
                background: C.amberSoft,
                padding: "22px 26px",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <AlertTriangle
                  size={16}
                  color="#f5a524"
                />

                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  Learning signals detected
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                }}
              >
                {performance.misconceptions.map(
                  (m, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "#fde68a",
                      }}
                    >
                      <strong>
                        {m.concept}:
                      </strong>{" "}
                      {m.type}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* QUESTION-BY-QUESTION */}

          <div
            style={{
              borderRadius: 24,
              border: `1px solid ${C.border}`,
              background: C.panel,
              backdropFilter: "blur(18px)",
              padding: "22px 26px",
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              Question by question
            </h2>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {answers.map(
                (answer, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "space-between",
                      padding: "11px 14px",
                      borderRadius: 12,
                      background:
                        "rgba(255,255,255,.02)",
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {answer.correct ? (
                        <CheckCircle2
                          size={16}
                          color="#34d399"
                        />
                      ) : (
                        <XCircle
                          size={16}
                          color="#f87171"
                        />
                      )}

                      <span
                        style={{
                          fontSize: 13,
                        }}
                      >
                        Question {index + 1} ·{" "}
                        {answer.concept}
                      </span>
                    </div>

                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        color: C.muted,
                      }}
                    >
                      <Clock size={12} />
                      {answer.time_taken}s
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ACTIONS */}

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() =>
                window.location.reload()
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                borderRadius: 12,
                border: `1px solid ${C.borderStrong}`,
                background:
                  "rgba(148,163,184,.06)",
                color: C.text,
                fontWeight: 650,
                fontSize: 14,
              }}
            >
              <RotateCcw size={16} />
              Retake test
            </button>

            <button
              onClick={() =>
                navigate("/classroom")
              }
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, #38bdf8, #6366f1)",
                color: "#04101d",
                fontWeight: 750,
                fontSize: 14,
                boxShadow:
                  "0 10px 30px rgba(56,189,248,.2)",
              }}
            >
              Learn with ASCORA
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * TEST UI
   * =========================================================
   */

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
      }}
    >
      <style>{testCss}</style>

      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12.5,
                color: C.muted,
                marginBottom: 4,
              }}
            >
              ASCORA Assessment
            </p>

            <h1
              style={{
                fontSize: 22,
                fontWeight: 750,
              }}
            >
              {currentQuestion.topic}
            </h1>
          </div>

          <span
            style={{
              color: C.muted,
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            {currentIndex + 1}/
            {questions.length}
          </span>
        </div>

        {/* PROGRESS */}

        <div
          className="test-progress-track"
          style={{
            marginBottom: 32,
          }}
        >
          <div
            className="test-progress-fill"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        {/* QUESTION CARD */}

        <div
          style={{
            borderRadius: 24,
            border: `1px solid ${C.border}`,
            background: C.panel,
            backdropFilter: "blur(18px)",
            padding: "30px 28px",
          }}
        >
          <p
            style={{
              fontSize: 12.5,
              color: C.muted,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: ".04em",
            }}
          >
            {currentQuestion.concept}
          </p>

          <h2
            style={{
              fontSize: 21,
              fontWeight: 650,
              lineHeight: 1.45,
              marginBottom: 26,
            }}
          >
            {currentQuestion.question}
          </h2>

          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {currentQuestion.options.map(
              (option, index) => {
                const selected =
                  selectedAnswer === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setSelectedAnswer(option)
                    }
                    className={`test-option ${
                      selected
                        ? "selected"
                        : ""
                    }`}
                  >
                    <span className="test-letter">
                      {String.fromCharCode(
                        65 + index
                      )}
                    </span>

                    {option}
                  </button>
                );
              }
            )}
          </div>

          {error && (
            <div
              style={{
                marginTop: 18,
                color: "#fca5a5",
                fontSize: 13.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submitCurrentAnswer}
            disabled={loading}
            style={{
              marginTop: 26,
              width: "100%",
              borderRadius: 14,
              padding: "14px 16px",
              background:
                "linear-gradient(135deg, #38bdf8, #6366f1)",
              color: "#04101d",
              fontWeight: 750,
              fontSize: 14.5,
              opacity: loading ? 0.6 : 1,
              boxShadow:
                "0 10px 30px rgba(56,189,248,.18)",
            }}
          >
            {loading
              ? "Saving..."
              : currentIndex ===
                questions.length - 1
              ? "Finish Assessment"
              : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
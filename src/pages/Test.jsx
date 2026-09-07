import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";

const DEMO_QUESTIONS = [
  {
    id: "q1",
    question:
      "What is photosynthesis?",
    options: [
      "The process by which plants make food using light",
      "The process by which plants absorb oxygen",
      "The process by which plants produce soil",
      "The process by which plants lose water",
    ],
    correctAnswer:
      "The process by which plants make food using light",
    topic: "Biology",
    concept: "Photosynthesis",
    difficulty: 1,
  },

  {
    id: "q2",
    question:
      "Which gas is mainly used by plants during photosynthesis?",
    options: [
      "Oxygen",
      "Carbon dioxide",
      "Nitrogen",
      "Hydrogen",
    ],
    correctAnswer:
      "Carbon dioxide",
    topic: "Biology",
    concept: "Photosynthesis",
    difficulty: 1,
  },

  {
    id: "q3",
    question:
      "What is the main function of chlorophyll?",
    options: [
      "Absorb light energy",
      "Absorb water",
      "Produce oxygen directly",
      "Store soil nutrients",
    ],
    correctAnswer:
      "Absorb light energy",
    topic: "Biology",
    concept: "Chlorophyll",
    difficulty: 2,
  },
];

export default function Test({
  user: userProp,
}) {
  const navigate = useNavigate();

  const [user, setUser] =
    useState(userProp || null);

  const [questions] =
    useState(DEMO_QUESTIONS);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [selectedAnswer, setSelectedAnswer] =
    useState("");

  const [answers, setAnswers] =
    useState([]);

  const [questionStartTime] =
    useState(Date.now());

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [finished, setFinished] =
    useState(false);

  // ==========================================
  // GET AUTH USER
  // ==========================================

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: {
          user: currentUser,
        },
      } =
        await supabase.auth.getUser();

      if (!currentUser) {
        navigate("/login");
        return;
      }

      setUser(currentUser);
    };

    if (!userProp) {
      loadUser();
    }
  }, [userProp, navigate]);

  const currentQuestion =
    questions[currentIndex];

  // ==========================================
  // PROGRESS
  // ==========================================

  const progress = useMemo(() => {
    return (
      ((currentIndex + 1) /
        questions.length) *
      100
    );
  }, [
    currentIndex,
    questions.length,
  ]);

  // ==========================================
  // SAVE ANSWER
  // ==========================================

  const submitCurrentAnswer =
    async () => {
      if (!selectedAnswer) {
        setError(
          "Please select an answer."
        );

        return;
      }

      if (!user) {
        setError(
          "You are not logged in."
        );

        return;
      }

      setError("");
      setLoading(true);

      const timeTaken = Math.max(
        1,
        Math.round(
          (Date.now() -
            questionStartTime) /
            1000
        )
      );

      const correct =
        selectedAnswer ===
        currentQuestion.correctAnswer;

      const attempt = {
        question_id:
          currentQuestion.id,

        topic:
          currentQuestion.topic,

        concept:
          currentQuestion.concept,

        difficulty:
          currentQuestion.difficulty,

        answer:
          selectedAnswer,

        correct,

        time_taken:
          timeTaken,

        attempts: 1,

        hints_used: 0,

        answer_changed: false,

        question:
          currentQuestion.question,
      };

      try {
        // ======================================
        // SEND TO BACKEND
        // ======================================

        const result =
          await apiFetch(
            "/api/assessment/attempt",
            {
              method: "POST",

              body: JSON.stringify(
                attempt
              ),
            }
          );

        console.log(
          "ASSESSMENT SAVED:",
          result
        );

        // ======================================
        // LOCAL RESULT
        // ======================================

        setAnswers((previous) => [
          ...previous,
          {
            ...attempt,
            misconception:
              result?.misconception ||
              null,
          },
        ]);

        // ======================================
        // NEXT QUESTION
        // ======================================

        if (
          currentIndex <
          questions.length - 1
        ) {
          setCurrentIndex(
            (previous) =>
              previous + 1
          );

          setSelectedAnswer("");
        } else {
          setFinished(true);
        }
      } catch (err) {
        console.error(
          "ASSESSMENT SAVE ERROR:",
          err
        );

        setError(
          err?.message ||
            "Could not save your answer."
        );
      } finally {
        setLoading(false);
      }
    };

  // ==========================================
  // RESULTS
  // ==========================================

  if (finished) {
    const score =
      answers.filter(
        (answer) =>
          answer.correct
      ).length;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl text-center">

          <div className="text-6xl mb-6">
            🎓
          </div>

          <h1 className="text-4xl font-bold">
            Assessment Complete
          </h1>

          <p className="text-white/50 mt-3">
            Your learning data has been
            recorded.
          </p>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">

            <div className="text-5xl font-bold">
              {score}/{questions.length}
            </div>

            <p className="text-white/50 mt-2">
              Your score
            </p>

            <div className="mt-6 space-y-3 text-left">
              {answers.map(
                (answer, index) => (
                  <div
                    key={index}
                    className="rounded-xl bg-white/5 p-4"
                  >
                    <div className="flex justify-between">
                      <span>
                        Question{" "}
                        {index + 1}
                      </span>

                      <span>
                        {answer.correct
                          ? "✓ Correct"
                          : "✗ Incorrect"}
                      </span>
                    </div>

                    {answer.misconception && (
                      <p className="text-sm text-yellow-400 mt-2">
                        Learning signal detected:
                        {" "}
                        {
                          answer
                            .misconception
                            .type
                        }
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          <button
            onClick={() =>
              navigate(
                "/classroom"
              )
            }
            className="mt-8 px-8 py-3 rounded-xl bg-white text-black font-semibold"
          >
            Learn with ASCORA
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // TEST UI
  // ==========================================

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">

      <div className="max-w-3xl mx-auto">

        {/* HEADER */}

        <div className="flex justify-between items-center mb-8">

          <div>
            <p className="text-sm text-white/40">
              ASCORA Assessment
            </p>

            <h1 className="text-2xl font-bold">
              {currentQuestion.topic}
            </h1>
          </div>

          <span className="text-white/40">
            {currentIndex + 1}/
            {questions.length}
          </span>
        </div>

        {/* PROGRESS */}

        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-10">
          <div
            className="h-full bg-white transition-all"
            style={{
              width:
                `${progress}%`,
            }}
          />
        </div>

        {/* QUESTION */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 md:p-10">

          <p className="text-sm text-white/40 mb-4">
            {currentQuestion.concept}
          </p>

          <h2 className="text-2xl md:text-3xl font-semibold leading-relaxed">
            {currentQuestion.question}
          </h2>

          {/* OPTIONS */}

          <div className="mt-8 space-y-3">

            {currentQuestion.options.map(
              (option, index) => {
                const selected =
                  selectedAnswer ===
                  option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setSelectedAnswer(
                        option
                      )
                    }
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      selected
                        ? "border-white bg-white/10"
                        : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="inline-flex w-8 h-8 rounded-full bg-white/10 items-center justify-center mr-3">
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

          {/* ERROR */}

          {error && (
            <div className="mt-5 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* BUTTON */}

          <button
            type="button"
            onClick={
              submitCurrentAnswer
            }
            disabled={loading}
            className="mt-8 w-full rounded-xl bg-white text-black py-3.5 font-semibold disabled:opacity-50"
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
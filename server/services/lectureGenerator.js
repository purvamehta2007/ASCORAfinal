// Personalized Lecture Generation (Parts 5-7)
//
// Turns {student profile, adaptive strategy, topic, doubt} into a
// structured lecture: an ordered list of steps, each carrying both
// the spoken text (for useVoice's TTS) and a visual description (for
// VisualLecture.jsx) so voice and visuals can stay in sync (Part 8).
//
// The actual explanatory sentences come from the existing
// provider-agnostic chat() adapter in aiProvider.js - this module's
// job is deciding HOW MANY steps, WHAT KIND of visual, and WHAT the
// checkpoint question should be, based on the student's profile and
// strategy. When a real LLM provider is wired into aiProvider.js,
// this module needs no changes.

import { chat } from "./aiProvider.js";

// --------------------------------------------------
// Visual type inference (Part 7) - purely topic-driven,
// not hardcoded per-student.
// --------------------------------------------------

function inferVisualType(topic = "") {
  const t = topic.toLowerCase();
  if (t.includes("equation") || t.includes("algebra")) return "equation_steps";
  if (t.includes("fraction")) return "fraction_model";
  if (t.includes("geometry") || t.includes("triangle") || t.includes("angle"))
    return "geometry_shape";
  if (t.includes("physics") || t.includes("force") || t.includes("motion"))
    return "physics_vectors";
  return "concept_flow";
}

function fallbackEquationSteps(misconception) {
  // A representative worked transformation used when the visual needs
  // concrete stages and we don't have a real equation parsed out of
  // the student's spoken doubt (that requires a real NLP/LLM parse,
  // which aiProvider.js does not currently provide - flagged in the
  // final report as a known limitation).
  return {
    stages: ["2x + 4 = 10", "2x = 6", "x = 3"],
    highlight: misconception?.type === "coefficient_handling" ? 1 : 0,
  };
}

// A checkpoint's expectedConcept is matched against the student's
// SPOKEN answer (responseEvaluator.js), so it needs to be a
// descriptive phrase a real answer might echo - not a raw DB slug
// like "equation_manipulation", which a spoken sentence would never
// contain verbatim. This is topic-content authoring (not a
// student-specific/psychological value), and is intentionally
// generic across subjects rather than hardcoded to one topic.
function expectedConceptFor(topic = "", misconception) {
  const t = topic.toLowerCase();

  if (t.includes("equation") || t.includes("algebra")) {
    return "perform the same inverse operation on both sides of the equation to isolate the variable";
  }
  if (t.includes("fraction")) {
    return "find a common denominator or an equivalent fraction";
  }
  if (t.includes("geometry") || t.includes("triangle") || t.includes("angle")) {
    return "identify the given angle, side, or vertex relationship";
  }
  if (t.includes("physics") || t.includes("force") || t.includes("motion")) {
    return "identify the forces and directions acting on the object";
  }

  return misconception?.concept || topic || "the key idea";
}

// --------------------------------------------------
// Lecture shape validation
// --------------------------------------------------

const STEP_TYPES = ["explanation", "example", "checkpoint", "recap"];

export function validateLecture(lecture) {
  if (!lecture || typeof lecture !== "object") return false;
  if (!Array.isArray(lecture.steps) || lecture.steps.length === 0)
    return false;

  return lecture.steps.every((step) => {
    if (!step || typeof step !== "object") return false;
    if (!STEP_TYPES.includes(step.type)) return false;
    if (typeof step.speech !== "string" || !step.speech.trim()) return false;
    if (step.type === "checkpoint") {
      return (
        typeof step.question === "string" && step.question.trim().length > 0
      );
    }
    return true;
  });
}

// --------------------------------------------------
// Fallback lecture (Part 24) - used only if generation
// throws or produces something that fails validation.
// Clearly marked as a fallback, never presented as AI-generated.
// --------------------------------------------------

function buildFallbackLecture({ topic, doubt, strategy }) {
  const visualType = inferVisualType(topic);

  return {
    title: `Understanding ${topic || "this topic"}`,
    objective: strategy?.objective || `Understand ${topic || "the topic"}`,
    strategy: {
      difficulty: strategy?.difficulty || "beginner",
      pace: strategy?.pace || "slow",
      scaffolding: strategy?.scaffolding || "high",
      visualSupport: strategy?.visualSupport ?? true,
    },
    fallback: true,
    steps: [
      {
        id: "step1",
        type: "explanation",
        speech: `Let's work through your question about ${
          topic || "this topic"
        } step by step.`,
        visual: { type: visualType, data: fallbackEquationSteps(null) },
      },
      {
        id: "step2",
        type: "checkpoint",
        speech: "What do you think the first step should be?",
        question: "What do you think the first step should be?",
        expectedConcept: topic || "the topic",
      },
      {
        id: "step3",
        type: "recap",
        speech:
          "We'll keep practicing this together - let your teacher know if you're still unsure.",
        visual: { type: visualType, data: fallbackEquationSteps(null) },
      },
    ],
  };
}

// --------------------------------------------------
// Main generator
// --------------------------------------------------

export async function generateLecture({
  studentId,
  topic,
  doubt,
  objective,
  profile = {},
  strategy = {},
}) {
  try {
    const misconception = strategy.misconception;
    const visualType = inferVisualType(topic);
    const visualData = fallbackEquationSteps(misconception);

    // Step 1: EXPLANATION - directly addresses the misconception when
    // one exists (Part 3), otherwise a general explanation of the doubt.
    const explanationMessage = misconception
      ? `explain why ${misconception.type?.replaceAll("_", " ")} matters for: ${doubt}`
      : doubt || `explain ${topic}`;

    const explanationText = await chat({
      message: explanationMessage,
      context: {
        topic,
        misconceptions: misconception ? [misconception.type] : [],
        pace: strategy.pace,
      },
    });

    // Step 2: EXAMPLE - complexity driven by strategy.exampleComplexity,
    // not by the student's raw mastery number directly.
    const exampleText = await chat({
      message: `give me ${strategy.exampleComplexity || "a"} example for ${
        topic || "this"
      }`,
      context: { topic, pace: strategy.pace },
    });

    // Step 3: CHECKPOINT - question style depends on questioningStyle.
    const checkpointQuestion =
      strategy.questioningStyle === "independent"
        ? `Now try a similar problem on your own for ${topic}. What's your answer?`
        : `What should we do first to solve this ${topic || "problem"}?`;

    const expectedConcept = expectedConceptFor(topic, misconception);

    // Step 4: RECAP
    const recapText = `To recap: we worked through ${
      topic || "this topic"
    }${misconception ? `, focusing on ${misconception.type.replaceAll("_", " ")}` : ""}.`;

    const lecture = {
      title: `Personalized lesson: ${topic || "Your question"}`,
      objective: objective || `Understand ${topic || "the topic"}`,
      strategy: {
        difficulty: strategy.difficulty,
        pace: strategy.pace,
        scaffolding: strategy.scaffolding,
        visualSupport: strategy.visualSupport,
      },
      fallback: false,
      steps: [
        {
          id: "step1",
          type: "explanation",
          speech: explanationText,
          visual: strategy.visualSupport
            ? { type: visualType, data: visualData }
            : null,
        },
        {
          id: "step2",
          type: "example",
          speech: exampleText,
          visual: strategy.visualSupport
            ? { type: visualType, data: visualData }
            : null,
        },
        {
          id: "step3",
          type: "checkpoint",
          speech: checkpointQuestion,
          question: checkpointQuestion,
          expectedConcept,
        },
        {
          id: "step4",
          type: "recap",
          speech: recapText,
          visual: strategy.visualSupport
            ? { type: visualType, data: visualData }
            : null,
        },
      ],
    };

    if (!validateLecture(lecture)) {
      console.error("Generated lecture failed validation, using fallback.");
      return buildFallbackLecture({ topic, doubt, strategy });
    }

    return lecture;
  } catch (error) {
    console.error("Lecture generation error:", error);
    return buildFallbackLecture({ topic, doubt, strategy });
  }
}

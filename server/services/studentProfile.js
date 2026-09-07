// Student Learning Profile
//
// Builds an observable, data-driven learning profile for a student.
// This is NOT a psychological diagnosis - every field is derived from
// assessment/interaction data already in Supabase (question_attempts,
// student_misconceptions, learning_events), reusing the existing
// masteryEngine for the actual mastery math (Part 2) rather than
// recomputing it here.
//
// When a signal genuinely cannot be computed (no attempts yet, no
// Supabase configured, etc.) we fall back to a clearly-flagged
// sensible default instead of inventing a value that looks real.

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { calculateMastery } from "./masteryEngine.js";

const FALLBACK_PROFILE_BASE = {
  currentTopic: "Linear Equations",
  mastery: 0.43,
  strengths: [],
  weakConcepts: ["equation manipulation"],
  misconceptions: ["incorrect_inverse_operation"],
  recentPerformance: { attempts: 0, accuracy: null },
  learningPace: "slow",
  visualSupport: true,
  scaffoldingLevel: "high",
  preferredExplanationStyle: "visual",
  difficultyLevel: 1,
  recentDoubts: [],
};

function paceFromMastery(mastery) {
  if (mastery < 0.5) return "slow";
  if (mastery < 0.8) return "moderate";
  return "fast";
}

function scaffoldingFromMastery(mastery, hasMisconception) {
  if (mastery < 0.5 || hasMisconception) return "high";
  if (mastery < 0.8) return "medium";
  return "low";
}

function difficultyFromMastery(mastery) {
  if (mastery < 0.5) return 1;
  if (mastery < 0.8) return 2;
  return 3;
}

/**
 * Build the Student Learning Profile.
 *
 * @param {string} studentId
 * @param {{ topic?: string }} [options] - optionally focus the profile
 *   on a specific topic (e.g. the topic of the doubt just asked). When
 *   omitted, the weakest known topic is used as currentTopic, matching
 *   the existing /api/student/:id/profile behaviour.
 */
export async function buildStudentProfile(studentId, options = {}) {
  const fallbackFields = [];

  if (!studentId || !supabaseAdmin) {
    fallbackFields.push(
      "mastery",
      "weakConcepts",
      "misconceptions",
      "recentPerformance",
      "learningPace",
      "scaffoldingLevel",
      "recentDoubts"
    );

    return {
      studentId: studentId || null,
      ...FALLBACK_PROFILE_BASE,
      currentTopic: options.topic || FALLBACK_PROFILE_BASE.currentTopic,
      fallback: true,
      fallbackFields,
    };
  }

  // --------------------------------------------------
  // MASTERY (reuses masteryEngine.js - Part 2)
  // --------------------------------------------------

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("question_attempts")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });

  if (attemptsError) {
    console.error("studentProfile attempts error:", attemptsError);
  }

  const attemptsByTopic = {};
  for (const attempt of attempts || []) {
    const topic = attempt.topic || "Unknown";
    (attemptsByTopic[topic] ||= []).push(attempt);
  }

  const masteryByTopic = {};
  for (const [topic, topicAttempts] of Object.entries(attemptsByTopic)) {
    masteryByTopic[topic] = calculateMastery(topicAttempts);
  }

  const hasAnyMasteryData = Object.keys(masteryByTopic).length > 0;
  if (!hasAnyMasteryData) fallbackFields.push("mastery");

  const weakConcepts = Object.entries(masteryByTopic)
    .filter(([, value]) => value.mastery < 0.6)
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .map(([topic]) => topic);

  const strengths = Object.entries(masteryByTopic)
    .filter(([, value]) => value.mastery >= 0.75)
    .map(([topic]) => topic);

  const currentTopic =
    options.topic || weakConcepts[0] || FALLBACK_PROFILE_BASE.currentTopic;

  const currentTopicMastery = hasAnyMasteryData
    ? masteryByTopic[currentTopic]?.mastery ?? 0.5
    : FALLBACK_PROFILE_BASE.mastery;

  if (!masteryByTopic[currentTopic]) {
    fallbackFields.push("mastery(currentTopic)");
  }

  // --------------------------------------------------
  // MISCONCEPTIONS (reuses the existing student_misconceptions
  // table populated by misconceptionEngine.js in the assessment
  // route - Part 3)
  // --------------------------------------------------

  const { data: misconceptionRows, error: misconceptionError } =
    await supabaseAdmin
      .from("student_misconceptions")
      .select("*")
      .eq("student_id", studentId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(10);

  if (misconceptionError) {
    console.error("studentProfile misconceptions error:", misconceptionError);
    fallbackFields.push("misconceptions");
  }

  const misconceptions = (misconceptionRows || []).map((row) => ({
    type: row.misconception_type,
    topic: row.topic,
    concept: row.concept,
    severity: row.severity,
  }));

  const topicMisconception = misconceptions.find(
    (m) => m.topic === currentTopic
  );

  // --------------------------------------------------
  // RECENT PERFORMANCE + RECENT DOUBTS
  // (reuses learning_events, already written by the assessment
  // route and the ASCORA answer/lecture routes - Part 13/14)
  // --------------------------------------------------

  const { data: recentEvents, error: eventsError } = await supabaseAdmin
    .from("learning_events")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (eventsError) {
    console.error("studentProfile events error:", eventsError);
    fallbackFields.push("recentPerformance", "recentDoubts");
  }

  const answerEvents = (recentEvents || []).filter((e) =>
    ["ANSWER_CORRECT", "ANSWER_INCORRECT"].includes(e.event_type)
  );

  const recentPerformance = answerEvents.length
    ? {
        attempts: answerEvents.length,
        accuracy:
          answerEvents.filter((e) => e.event_type === "ANSWER_CORRECT")
            .length / answerEvents.length,
      }
    : { attempts: 0, accuracy: null };

  if (!answerEvents.length) fallbackFields.push("recentPerformance");

  const recentDoubts = (recentEvents || [])
    .filter((e) => e.event_type === "DOUBT_RAISED")
    .slice(0, 5)
    .map((e) => ({
      topic: e.topic,
      doubt: e.metadata?.doubt || null,
      createdAt: e.created_at,
    }));

  // --------------------------------------------------
  // DERIVED STRATEGY INPUTS
  // --------------------------------------------------

  const learningPace = hasAnyMasteryData
    ? paceFromMastery(currentTopicMastery)
    : FALLBACK_PROFILE_BASE.learningPace;

  const scaffoldingLevel = scaffoldingFromMastery(
    currentTopicMastery,
    Boolean(topicMisconception)
  );

  const visualSupport =
    Boolean(topicMisconception) || currentTopicMastery < 0.6;

  const preferredExplanationStyle = topicMisconception
    ? topicMisconception.type?.includes("fraction")
      ? "visual"
      : "step_by_step_guidance"
    : visualSupport
    ? "visual"
    : "worked_example";

  const difficultyLevel = difficultyFromMastery(currentTopicMastery);

  return {
    studentId,
    currentTopic,
    mastery: currentTopicMastery,
    masteryByTopic,
    strengths,
    weakConcepts,
    misconceptions,
    recentPerformance,
    learningPace,
    visualSupport,
    scaffoldingLevel,
    preferredExplanationStyle,
    difficultyLevel,
    recentDoubts,
    fallback: fallbackFields.length > 0,
    fallbackFields,
  };
}

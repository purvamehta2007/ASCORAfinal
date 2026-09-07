// Adaptive Teaching Strategy
//
// Takes a Student Learning Profile + topic/doubt/objective and decides
// HOW to teach - not what to say. Reuses generateStrategy() from
// adaptiveEngine.js for the core action/reason decision (RETEACH vs
// PRACTICE) instead of re-deriving it, and layers on the richer
// per-lecture strategy fields the spec asks for.
//
// These are strategy rules driven by mastery/misconception data, not
// psychological profiling.

import { generateStrategy } from "./adaptiveEngine.js";

function masteryLevelFor(mastery) {
  if (mastery < 0.5) return "low";
  if (mastery < 0.8) return "medium";
  return "high";
}

const TIER_DEFAULTS = {
  low: {
    difficulty: "beginner",
    pace: "slow",
    scaffolding: "high",
    visualSupport: true,
    questioningStyle: "guided",
    prerequisiteRevision: true,
    exampleComplexity: "simple",
  },
  medium: {
    difficulty: "intermediate",
    pace: "moderate",
    scaffolding: "medium",
    visualSupport: true,
    questioningStyle: "guided-independent",
    prerequisiteRevision: false,
    exampleComplexity: "moderate",
  },
  high: {
    difficulty: "advanced",
    pace: "fast",
    scaffolding: "low",
    visualSupport: false,
    questioningStyle: "independent",
    prerequisiteRevision: false,
    exampleComplexity: "challenging",
  },
};

/**
 * @param {object} profile - a Student Learning Profile (see studentProfile.js)
 * @param {object} [context]
 * @param {string} [context.topic]
 * @param {string} [context.doubt]
 * @param {string} [context.objective]
 */
export function buildTeachingStrategy(profile = {}, context = {}) {
  const mastery = Number(profile.mastery ?? 0.5);
  const masteryLevel = masteryLevelFor(mastery);
  const tier = TIER_DEFAULTS[masteryLevel];

  const topic = context.topic || profile.currentTopic;
  const misconception = (profile.misconceptions || []).find(
    (m) => !topic || m.topic === topic
  );

  // Reuse the existing action/reason decision rather than duplicating it.
  const base = generateStrategy({
    weak_topics: [topic],
    mastery,
    pace: tier.pace,
    visual_support: profile.visualSupport,
    misconceptions: misconception ? [misconception.type] : [],
  });

  // A live misconception always forces high scaffolding + visual
  // support regardless of tier, since the point is to directly
  // address the specific misunderstanding (Part 3).
  const scaffolding = misconception ? "high" : tier.scaffolding;
  const visualSupport = misconception ? true : tier.visualSupport;

  return {
    masteryLevel,
    difficulty: tier.difficulty,
    pace: tier.pace,
    scaffolding,
    visualSupport,
    explanationStyle:
      profile.preferredExplanationStyle ||
      (visualSupport ? "visual" : "worked_example"),
    questioningStyle: tier.questioningStyle,
    prerequisiteRevision: misconception ? true : tier.prerequisiteRevision,
    exampleComplexity: tier.exampleComplexity,
    topic,
    objective: context.objective || `Understand ${topic || "the topic"}`,
    misconception: misconception || null,
    action: base.action,
    reason: base.reason,
  };
}

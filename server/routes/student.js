import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { calculateMastery } from "../services/masteryEngine.js";
import { generateStrategy } from "../services/adaptiveEngine.js";

export const studentRouter = Router();

studentRouter.get("/:studentId/profile", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!supabaseAdmin) {
      const strategy = generateStrategy({
        weak_topics: ["Linear Equations"],
        mastery: 0.43,
        pace: "slow",
        visual_support: true,
        misconceptions: [
          "incorrect_inverse_operation",
        ],
      });

      return res.json({
        student_id: studentId,
        mastery: 0.43,
        weak_topics: ["Linear Equations"],
        misconceptions: [
          "incorrect_inverse_operation",
        ],
        strategy,
      });
    }

    const { data: attempts, error } =
      await supabaseAdmin
        .from("question_attempts")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    const topics = {};

    for (const attempt of attempts || []) {
      const topic =
        attempt.topic || "Unknown";

      if (!topics[topic]) {
        topics[topic] = [];
      }

      topics[topic].push(attempt);
    }

    const mastery = {};

    for (const [topic, topicAttempts] of Object.entries(
      topics
    )) {
      mastery[topic] =
        calculateMastery(topicAttempts);
    }

    const weakTopics = Object.entries(
      mastery
    )
      .filter(([, value]) => value.mastery < 0.6)
      .sort(
        (a, b) =>
          a[1].mastery - b[1].mastery
      )
      .map(([topic]) => topic);

    const { data: misconceptions } =
      await supabaseAdmin
        .from("student_misconceptions")
        .select("*")
        .eq("student_id", studentId)
        .eq("resolved", false)
        .order("created_at", {
          ascending: false,
        });

    const misconceptionTypes = [
      ...new Set(
        (misconceptions || []).map(
          (m) => m.misconception_type
        )
      ),
    ];

    const weakestTopic =
      weakTopics[0] || "Current Topic";

    const topicMastery =
      mastery[weakestTopic]?.mastery || 0;

    const profile = {
      student_id: studentId,

      weak_topics: weakTopics,

      strong_topics: Object.entries(
        mastery
      )
        .filter(
          ([, value]) =>
            value.mastery >= 0.75
        )
        .map(([topic]) => topic),

      mastery,

      misconceptions:
        misconceptionTypes,

      pace:
        topicMastery < 0.5
          ? "slow"
          : "moderate",

      visual_support:
        misconceptionTypes.length > 0,
    };

    const strategy =
      generateStrategy(profile);

    res.json({
      profile,
      strategy,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Unable to generate student profile",
    });
  }
});
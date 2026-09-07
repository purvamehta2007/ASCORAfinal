import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";
import { generateAdaptiveAnswer } from "../services/adaptiveAnswer.js";
import { buildStudentProfile } from "../services/studentProfile.js";
import { buildTeachingStrategy } from "../services/adaptiveTeachingEngine.js";
import { generateLecture } from "../services/lectureGenerator.js";
import { evaluateResponse } from "../services/responseEvaluator.js";

export const ascoraRouter = Router();

// --------------------------------------------------
// Ownership guard (Part 22): a student must never be able to
// pull or drive another student's learning profile/lecture.
// --------------------------------------------------

function ensureOwnStudentId(req, res, studentId) {
  if (!req.user?.id || req.user.id !== studentId) {
    res.status(403).json({
      error: "You can only access your own learning data.",
    });
    return false;
  }
  return true;
}

// --------------------------------------------------
// ANSWER A STUDENT DOUBT (unchanged - single-shot fallback path,
// still used by the frontend if the full lecture pipeline below
// is unavailable)
//
// Body: { doubt: string, student_context: { topic, mastery,
// pace, visual, guided_questions, errors? } }
// --------------------------------------------------

ascoraRouter.post("/answer", async (req, res) => {
  try {
    const { doubt, student_context } = req.body || {};

    if (!doubt || typeof doubt !== "string" || !doubt.trim()) {
      return res.status(400).json({
        error: "doubt is required",
      });
    }

    const answer = await generateAdaptiveAnswer({
      doubt: doubt.trim(),
      student_context: student_context || {},
    });

    res.json({ answer });
  } catch (error) {
    console.error("ASCORA answer error:", error);

    res.status(500).json({
      error: "Unable to generate an answer right now.",
    });
  }
});

// --------------------------------------------------
// STUDENT CONTEXT (Part 1/17)
//
// Rebuilt on top of studentProfile.js instead of making an
// internal HTTP round-trip to /api/student/:id/profile. The
// original response shape (student_id, topic, mastery, strategy)
// is preserved for backward compatibility with the existing
// "Current student context" card in Ascora.jsx; `profile` and
// `adaptiveStrategy` are the full Part 1/4 objects added additively.
// --------------------------------------------------

ascoraRouter.get("/student/:id/context", requireAuth, async (req, res) => {
  try {
    const studentId = req.params.id;

    if (!ensureOwnStudentId(req, res, studentId)) return;

    const profile = await buildStudentProfile(studentId);
    const strategy = buildTeachingStrategy(profile, {
      topic: profile.currentTopic,
    });

    res.json({
      student_id: studentId,
      topic: profile.currentTopic,
      mastery: profile.mastery,
      // Backward-compatible shape the existing UI already reads:
      strategy: {
        pace: strategy.pace,
        visual: strategy.visualSupport,
        guided_questions: strategy.questioningStyle !== "independent",
      },
      // Full Part 1/4 objects for the new Learning Profile UI (Part 17):
      profile,
      adaptiveStrategy: strategy,
    });
  } catch (error) {
    console.error("ASCORA context error:", error);

    res.status(500).json({
      error: "Unable to load ASCORA context",
    });
  }
});

// --------------------------------------------------
// EVENT LOGGING (unchanged)
// --------------------------------------------------

ascoraRouter.post("/event", async (req, res) => {
  try {
    const { student_id, event } = req.body;

    if (supabaseAdmin && student_id) {
      await supabaseAdmin.from("learning_events").insert({
        student_id,
        event_type: String(event || "ASCORA_EVENT").toUpperCase(),
        metadata: {
          source: "ascora",
        },
      });
    }

    res.json({
      ok: true,
      event,
      event_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to record ASCORA event",
    });
  }
});

// --------------------------------------------------
// LECTURE: GENERATE (Parts 5/6/15)
//
// Body: { studentId, topic, doubt, objective }
// Returns: { lecture, strategy, studentProfile }
// --------------------------------------------------

ascoraRouter.post("/lecture/generate", requireAuth, async (req, res) => {
  try {
    const { studentId, topic, doubt, objective } = req.body || {};

    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ error: "studentId is required" });
    }

    if (!ensureOwnStudentId(req, res, studentId)) return;

    if (!doubt || typeof doubt !== "string" || !doubt.trim()) {
      return res.status(400).json({ error: "doubt is required" });
    }

    const profile = await buildStudentProfile(studentId, { topic });
    const strategy = buildTeachingStrategy(profile, {
      topic: topic || profile.currentTopic,
      doubt,
      objective,
    });

    const lecture = await generateLecture({
      studentId,
      topic: strategy.topic,
      doubt: doubt.trim(),
      objective: strategy.objective,
      profile,
      strategy,
    });

    // Record the doubt itself as a learning event so it shows up in
    // future profiles' recentDoubts (Part 1), and persist the
    // strategy/lecture using the existing teaching_strategies /
    // lesson_plans tables - reuses existing tables, no new ones.
    if (supabaseAdmin) {
      await supabaseAdmin.from("learning_events").insert({
        student_id: studentId,
        event_type: "DOUBT_RAISED",
        topic: strategy.topic,
        metadata: { doubt: doubt.trim() },
      });

      await supabaseAdmin.from("teaching_strategies").insert({
        student_id: studentId,
        topic: strategy.topic,
        action: strategy.action,
        strategy,
        reason: strategy.reason,
      });

      await supabaseAdmin.from("lesson_plans").insert({
        student_id: studentId,
        topic: strategy.topic,
        content: lecture,
      });
    }

    res.json({ lecture, strategy, studentProfile: profile });
  } catch (error) {
    console.error("ASCORA lecture generate error:", error);

    res.status(500).json({
      error: "Unable to generate a lecture right now.",
    });
  }
});

// --------------------------------------------------
// LECTURE: EVALUATE (Parts 11-13/15)
//
// Body: { studentId, topic, question, response, expectedConcept,
//         priorMisconceptionType? }
// Returns: { correct, feedback, adaptation, updatedProfile }
// --------------------------------------------------

ascoraRouter.post("/lecture/evaluate", requireAuth, async (req, res) => {
  try {
    const {
      studentId,
      topic,
      question,
      response: studentResponse,
      expectedConcept,
      priorMisconceptionType,
    } = req.body || {};

    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ error: "studentId is required" });
    }

    if (!ensureOwnStudentId(req, res, studentId)) return;

    const profile = await buildStudentProfile(studentId, { topic });

    const evaluation = evaluateResponse({
      question,
      response: studentResponse,
      expectedConcept,
      profile,
      priorMisconception: priorMisconceptionType
        ? { type: priorMisconceptionType }
        : null,
    });

    // Record the learning event + (if relevant) a new misconception,
    // reusing the existing tables (Part 13) rather than new ones.
    if (supabaseAdmin) {
      await supabaseAdmin.from("learning_events").insert({
        student_id: studentId,
        event_type: "LECTURE_CHECKPOINT",
        topic: topic || profile.currentTopic,
        metadata: {
          question,
          response: studentResponse,
          correct: evaluation.correct,
          nextAction: evaluation.nextAction,
          misconception: evaluation.detectedMisconception,
        },
      });

      if (evaluation.detectedMisconception) {
        await supabaseAdmin.from("student_misconceptions").insert({
          student_id: studentId,
          topic: topic || profile.currentTopic,
          concept: expectedConcept || null,
          misconception_type: evaluation.detectedMisconception.type,
          severity: evaluation.detectedMisconception.severity,
          evidence: { question, response: studentResponse },
        });
      }
    }

    const updatedProfile = await buildStudentProfile(studentId, { topic });

    res.json({
      correct: evaluation.correct,
      confidence: evaluation.confidence,
      detectedMisconception: evaluation.detectedMisconception,
      feedback: evaluation.feedback,
      adaptation: evaluation.nextAction,
      updatedProfile,
    });
  } catch (error) {
    console.error("ASCORA lecture evaluate error:", error);

    res.status(500).json({
      error: "Unable to evaluate the response right now.",
    });
  }
});

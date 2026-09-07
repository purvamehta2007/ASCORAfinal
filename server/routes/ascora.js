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
// Helpers
// --------------------------------------------------

function ensureOwnStudentId(
  req,
  res,
  studentId
) {
  if (
    !req.user?.id ||
    req.user.id !== studentId
  ) {
    res.status(403).json({
      error:
        "You can only access your own learning data.",
    });

    return false;
  }

  return true;
}

// --------------------------------------------------
// ANSWER STUDENT DOUBT
//
// IMPORTANT:
// - Authentication required.
// - Student ID comes from authenticated session.
// - Learning context comes from Supabase/server.
// - Client cannot override mastery/misconceptions.
// --------------------------------------------------

ascoraRouter.post(
  "/answer",
  requireAuth,
  async (req, res) => {
    try {
      const studentId = req.user.id;

      const {
        doubt,
        topic,
      } = req.body || {};

      if (
        !doubt ||
        typeof doubt !== "string" ||
        !doubt.trim()
      ) {
        return res.status(400).json({
          error: "doubt is required",
        });
      }

      // Build trusted student profile
      const profile =
        await buildStudentProfile(
          studentId,
          {
            topic:
              typeof topic === "string" &&
              topic.trim()
                ? topic.trim()
                : undefined,
          }
        );

      // Build adaptive teaching strategy
      const strategy =
        buildTeachingStrategy(
          profile,
          {
            topic:
              topic ||
              profile.currentTopic,

            doubt: doubt.trim(),
          }
        );

      // Generate AI response using trusted
      // server-side learning context
      const answer =
        await generateAdaptiveAnswer({
          doubt: doubt.trim(),

          student_context: {
            topic:
              strategy.topic ||
              profile.currentTopic,

            mastery:
              profile.mastery,

            pace:
              strategy.pace ||
              profile.learningPace,

            difficulty:
              strategy.difficulty ||
              profile.difficultyLevel,

            scaffolding:
              strategy.scaffolding ||
              profile.scaffoldingLevel,

            visualSupport:
              strategy.visualSupport ??
              profile.visualSupport,

            misconceptions:
              profile.misconceptions,
          },
        });

      // Record the doubt and answer
      // as learning events.
      if (supabaseAdmin) {
        const { error } =
          await supabaseAdmin
            .from("learning_events")
            .insert([
              {
                student_id:
                  studentId,

                event_type:
                  "DOUBT_RAISED",

                topic:
                  strategy.topic ||
                  profile.currentTopic,

                metadata: {
                  doubt:
                    doubt.trim(),
                  source:
                    "ascora",
                },
              },

              {
                student_id:
                  studentId,

                event_type:
                  "ASCORA_ANSWER",

                topic:
                  strategy.topic ||
                  profile.currentTopic,

                metadata: {
                  doubt:
                    doubt.trim(),

                  answer,

                  strategy: {
                    pace:
                      strategy.pace,

                    difficulty:
                      strategy.difficulty,

                    scaffolding:
                      strategy.scaffolding,

                    visualSupport:
                      strategy.visualSupport,
                  },
                },
              },
            ]);

        if (error) {
          console.error(
            "ASCORA learning event error:",
            error
          );
        }
      }

      return res.json({
        answer,

        studentId,

        topic:
          strategy.topic ||
          profile.currentTopic,

        studentProfile:
          profile,

        adaptiveStrategy:
          strategy,
      });
    } catch (error) {
      console.error(
        "ASCORA answer error:",
        error?.message || error
      );

      return res.status(500).json({
        error:
          "Unable to generate an answer right now.",
      });
    }
  }
);

// --------------------------------------------------
// STUDENT CONTEXT
// --------------------------------------------------

ascoraRouter.get(
  "/student/:id/context",
  requireAuth,
  async (req, res) => {
    try {
      const studentId =
        req.params.id;

      if (
        !ensureOwnStudentId(
          req,
          res,
          studentId
        )
      ) {
        return;
      }

      const profile =
        await buildStudentProfile(
          studentId
        );

      const strategy =
        buildTeachingStrategy(
          profile,
          {
            topic:
              profile.currentTopic,
          }
        );

      return res.json({
        student_id:
          studentId,

        topic:
          profile.currentTopic,

        mastery:
          profile.mastery,

        strategy: {
          pace:
            strategy.pace,

          visual:
            strategy.visualSupport,

          guided_questions:
            strategy.questioningStyle !==
            "independent",
        },

        profile,

        adaptiveStrategy:
          strategy,
      });
    } catch (error) {
      console.error(
        "ASCORA context error:",
        error?.message || error
      );

      return res.status(500).json({
        error:
          "Unable to load ASCORA context",
      });
    }
  }
);

// --------------------------------------------------
// EVENT LOGGING
// --------------------------------------------------

ascoraRouter.post(
  "/event",
  requireAuth,
  async (req, res) => {
    try {
      const studentId =
        req.user.id;

      const {
        event,
        topic,
        metadata = {},
      } = req.body || {};

      if (!supabaseAdmin) {
        return res.json({
          ok: true,
          stored: false,
          event,
        });
      }

      const {
        error,
      } = await supabaseAdmin
        .from("learning_events")
        .insert({
          student_id:
            studentId,

          event_type:
            String(
              event ||
                "ASCORA_EVENT"
            ).toUpperCase(),

          topic:
            topic || null,

          metadata: {
            source:
              "ascora",
            ...metadata,
          },
        });

      if (error) {
        console.error(
          "ASCORA event DB error:",
          error
        );

        return res.status(500).json({
          error:
            "Failed to record ASCORA event",
        });
      }

      return res.json({
        ok: true,
        stored: true,
        event,
        event_time:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "ASCORA event error:",
        error?.message || error
      );

      return res.status(500).json({
        error:
          "Failed to record ASCORA event",
      });
    }
  }
);

// --------------------------------------------------
// GENERATE ADAPTIVE LECTURE
// --------------------------------------------------

ascoraRouter.post(
  "/lecture/generate",
  requireAuth,
  async (req, res) => {
    try {
      const {
        studentId,
        topic,
        doubt,
        objective,
      } = req.body || {};

      if (
        !studentId ||
        typeof studentId !== "string"
      ) {
        return res.status(400).json({
          error:
            "studentId is required",
        });
      }

      if (
        !ensureOwnStudentId(
          req,
          res,
          studentId
        )
      ) {
        return;
      }

      if (
        !doubt ||
        typeof doubt !== "string" ||
        !doubt.trim()
      ) {
        return res.status(400).json({
          error:
            "doubt is required",
        });
      }

      const profile =
        await buildStudentProfile(
          studentId,
          { topic }
        );

      const strategy =
        buildTeachingStrategy(
          profile,
          {
            topic:
              topic ||
              profile.currentTopic,

            doubt:
              doubt.trim(),

            objective,
          }
        );

      const lecture =
        await generateLecture({
          studentId,

          topic:
            strategy.topic,

          doubt:
            doubt.trim(),

          objective:
            strategy.objective,

          profile,

          strategy,
        });

      if (supabaseAdmin) {
        await supabaseAdmin
          .from("learning_events")
          .insert({
            student_id:
              studentId,

            event_type:
              "DOUBT_RAISED",

            topic:
              strategy.topic,

            metadata: {
              doubt:
                doubt.trim(),
            },
          });

        await supabaseAdmin
          .from("teaching_strategies")
          .insert({
            student_id:
              studentId,

            topic:
              strategy.topic,

            action:
              strategy.action,

            strategy,

            reason:
              strategy.reason,
          });

        await supabaseAdmin
          .from("lesson_plans")
          .insert({
            student_id:
              studentId,

            topic:
              strategy.topic,

            content:
              lecture,
          });
      }

      return res.json({
        lecture,
        strategy,
        studentProfile:
          profile,
      });
    } catch (error) {
      console.error(
        "ASCORA lecture generate error:",
        error?.message || error
      );

      return res.status(500).json({
        error:
          "Unable to generate a lecture right now.",
      });
    }
  }
);

// --------------------------------------------------
// LECTURE CHECKPOINT EVALUATION
// --------------------------------------------------

ascoraRouter.post(
  "/lecture/evaluate",
  requireAuth,
  async (req, res) => {
    try {
      const {
        studentId,
        topic,
        question,
        response:
          studentResponse,
        expectedConcept,
        priorMisconceptionType,
      } = req.body || {};

      if (
        !studentId ||
        typeof studentId !== "string"
      ) {
        return res.status(400).json({
          error:
            "studentId is required",
        });
      }

      if (
        !ensureOwnStudentId(
          req,
          res,
          studentId
        )
      ) {
        return;
      }

      if (
        !question ||
        typeof question !== "string"
      ) {
        return res.status(400).json({
          error:
            "question is required",
        });
      }

      if (
        !studentResponse ||
        typeof studentResponse !== "string"
      ) {
        return res.status(400).json({
          error:
            "response is required",
        });
      }

      const profile =
        await buildStudentProfile(
          studentId,
          { topic }
        );

      const evaluation =
        evaluateResponse({
          question,

          response:
            studentResponse,

          expectedConcept,

          profile,

          priorMisconception:
            priorMisconceptionType
              ? {
                  type:
                    priorMisconceptionType,
                }
              : null,
        });

      if (supabaseAdmin) {
        await supabaseAdmin
          .from("learning_events")
          .insert({
            student_id:
              studentId,

            event_type:
              "LECTURE_CHECKPOINT",

            topic:
              topic ||
              profile.currentTopic,

            metadata: {
              question,

              response:
                studentResponse,

              correct:
                evaluation.correct,

              nextAction:
                evaluation.nextAction,

              misconception:
                evaluation.detectedMisconception,
            },
          });

        if (
          evaluation.detectedMisconception
        ) {
          await supabaseAdmin
            .from(
              "student_misconceptions"
            )
            .insert({
              student_id:
                studentId,

              topic:
                topic ||
                profile.currentTopic,

              concept:
                expectedConcept ||
                null,

              misconception_type:
                evaluation
                  .detectedMisconception
                  .type,

              severity:
                evaluation
                  .detectedMisconception
                  .severity,

              evidence: {
                question,

                response:
                  studentResponse,
              },
            });
        }
      }

      const updatedProfile =
        await buildStudentProfile(
          studentId,
          { topic }
        );

      return res.json({
        correct:
          evaluation.correct,

        confidence:
          evaluation.confidence,

        detectedMisconception:
          evaluation.detectedMisconception,

        feedback:
          evaluation.feedback,

        adaptation:
          evaluation.nextAction,

        updatedProfile,
      });
    } catch (error) {
      console.error(
        "ASCORA lecture evaluate error:",
        error?.message || error
      );

      return res.status(500).json({
        error:
          "Unable to evaluate the response right now.",
      });
    }
  }
);
import { Router } from "express";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";

import {
  detectMisconception,
} from "../services/misconceptionEngine.js";

export const assessmentRouter =
  Router();

assessmentRouter.post(
  "/attempt",
  requireAuth,
  async (req, res) => {
    try {
      const {
        question_id,
        topic,
        concept,
        difficulty,
        answer,
        correct,
        time_taken,
        attempts,
        hints_used,
        answer_changed,
        question,
      } = req.body;

      const student_id =
        req.user.id;

      if (!supabaseAdmin) {
        return res.status(500).json({
          error:
            "Supabase server is not configured.",
        });
      }

      if (!question_id) {
        return res.status(400).json({
          error:
            "question_id is required.",
        });
      }

      // ==========================================
      // MISCONCEPTION DETECTION
      // ==========================================

      const misconception =
        detectMisconception({
          question,
          answer,
          correct,
          concept,
        });

      // ==========================================
      // QUESTION ATTEMPT
      // ==========================================

      const attemptPayload = {
        student_id,

        question_id,

        topic:
          topic || null,

        concept:
          concept || null,

        difficulty:
          Number(difficulty || 1),

        answer:
          answer || "",

        correct:
          Boolean(correct),

        time_taken_seconds:
          Number(time_taken || 0),

        attempts:
          Number(attempts || 1),

        hints_used:
          Number(hints_used || 0),

        answer_changed:
          Boolean(answer_changed),

        error_type:
          misconception?.type ||
          null,
      };

      const {
        data: attempt,
        error: attemptError,
      } =
        await supabaseAdmin
          .from(
            "question_attempts"
          )
          .insert(
            attemptPayload
          )
          .select()
          .single();

      if (attemptError) {
        console.error(
          "ATTEMPT INSERT ERROR:",
          attemptError
        );

        return res.status(500).json({
          error:
            attemptError.message,
          code:
            attemptError.code,
        });
      }

      // ==========================================
      // MISCONCEPTION
      // ==========================================

      let savedMisconception =
        null;

      if (misconception) {
        const {
          data,
          error,
        } =
          await supabaseAdmin
            .from(
              "student_misconceptions"
            )
            .insert({
              student_id,

              topic:
                topic || null,

              concept:
                concept || null,

              misconception_type:
                misconception.type,

              severity:
                misconception.severity,

              evidence: {
                question,
                answer,
              },
            })
            .select()
            .single();

        if (error) {
          console.error(
            "MISCONCEPTION ERROR:",
            error
          );
        } else {
          savedMisconception =
            data;
        }
      }

      // ==========================================
      // LEARNING EVENT
      // ==========================================

      const {
        error: eventError,
      } =
        await supabaseAdmin
          .from("learning_events")
          .insert({
            student_id,

            event_type:
              correct
                ? "ANSWER_CORRECT"
                : "ANSWER_INCORRECT",

            topic:
              topic || null,

            metadata: {
              question_id,
              concept,
              difficulty,
              answer,
              correct,
              time_taken,
              attempts,
              hints_used,
              answer_changed,
              misconception,
            },
          });

      if (eventError) {
        console.error(
          "LEARNING EVENT ERROR:",
          eventError
        );
      }

      // ==========================================
      // RESPONSE
      // ==========================================

      return res.json({
        ok: true,

        student_id,

        attempt,

        misconception:
          savedMisconception ||
          misconception ||
          null,
      });
    } catch (error) {
      console.error(
        "ASSESSMENT ROUTE ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to process assessment.",
        message:
          error.message,
      });
    }
  }
);
import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";
import { generateDailyPlan } from "../services/automatedPlanner.js";

const plannerRouter = Router();

/* ============================================================
   GET TODAY'S SCHEDULE
   GET /api/planner/today
============================================================ */

plannerRouter.get("/today", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("schedule_items")
      .select("*")
      .eq("scheduled_date", today)
      .order("start_time", {
        ascending: true,
      });

    if (error) {
      console.error("Planner /today error:", error);

      return res.status(500).json({
        error: "Failed to load today's schedule",
      });
    }

    return res.json({
      ok: true,
      date: today,
      items: data || [],
    });
  } catch (error) {
    console.error("Planner /today exception:", error);

    return res.status(500).json({
      error: "Failed to load today's schedule",
    });
  }
});

/* ============================================================
   GET SCHEDULE FOR A DATE
   GET /api/planner/schedule?date=YYYY-MM-DD
============================================================ */

plannerRouter.get("/schedule", requireAuth, async (req, res) => {
  try {
    const date =
      typeof req.query.date === "string" && req.query.date
        ? req.query.date
        : new Date().toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("schedule_items")
      .select("*")
      .eq("scheduled_date", date)
      .order("start_time", {
        ascending: true,
      });

    if (error) {
      console.error("Planner /schedule error:", error);

      return res.status(500).json({
        error: "Failed to load schedule",
      });
    }

    return res.json({
      ok: true,
      date,
      items: data || [],
    });
  } catch (error) {
    console.error("Planner /schedule exception:", error);

    return res.status(500).json({
      error: "Failed to load schedule",
    });
  }
});

/* ============================================================
   GENERATE AUTOMATED DAILY PLAN
   POST /api/planner/generate
============================================================ */

plannerRouter.post("/generate", requireAuth, async (req, res) => {
  try {
    const {
      classroomId,
      studentId,
      date,
      topics,
      durationMinutes,
    } = req.body || {};

    /*
     * classroomId is required because schedule_items
     * belongs to a classroom.
     */
    if (!classroomId) {
      return res.status(400).json({
        error: "classroomId is required",
      });
    }

    /*
     * Topics are currently supplied by the caller.
     * Later we can replace this with automatic curriculum
     * retrieval from the database.
     */
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        error: "At least one topic is required",
      });
    }

    /*
     * If no studentId is supplied, use the authenticated
     * user's ID.
     */
    const resolvedStudentId = studentId || req.user?.id;

    if (!resolvedStudentId) {
      return res.status(400).json({
        error: "studentId is required",
      });
    }

    const result = await generateDailyPlan({
      classroomId,
      studentId: resolvedStudentId,
      date:
        typeof date === "string" && date
          ? date
          : new Date().toISOString().slice(0, 10),
      topics,
      durationMinutes:
        Number(durationMinutes) > 0
          ? Number(durationMinutes)
          : 45,
    });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Planner generation error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate automated plan",
    });
  }
});

/* ============================================================
   HEALTH CHECK
   GET /api/planner/health
============================================================ */

plannerRouter.get("/health", (req, res) => {
  return res.json({
    ok: true,
    service: "planner",
    message: "Planner API is running",
  });
});

export default plannerRouter;
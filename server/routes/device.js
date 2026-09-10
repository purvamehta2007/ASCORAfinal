import { Router } from "express";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { buildStudentProfile } from "../services/studentProfile.js";
import { buildTeachingStrategy } from "../services/adaptiveTeachingEngine.js";
import { generateLecture } from "../services/lectureGenerator.js";

const deviceRouter = Router();

// --------------------------------------------------
// India date + time
// --------------------------------------------------

function indiaDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

// --------------------------------------------------
// Check whether a schedule item is currently live
// --------------------------------------------------

function isLive(item, currentTime) {
  if (!item) return false;

  return (
    item.start_time <= currentTime &&
    currentTime < item.end_time
  );
}

// --------------------------------------------------
// DEVICE HEALTH
// Login-free
// --------------------------------------------------

deviceRouter.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ascora-device",
    message: "ASCORA device API is running",
  });
});

// --------------------------------------------------
// CURRENT SCHEDULE
// Login-free
// Used by Raspberry Pi
// --------------------------------------------------

deviceRouter.get("/current", async (req, res) => {
  try {
    const { date, time } = indiaDateTime();

    const { data, error } = await supabaseAdmin
      .from("schedule_items")
      .select("*")
      .eq("scheduled_date", date)
      .order("start_time", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Device schedule error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error: "Failed to load device schedule",
      });
    }

    const items = data || [];

    // Currently running lesson
    const active = items.find((item) =>
      isLive(item, time)
    );

    // Next upcoming item
    const upcoming = items.find(
      (item) => item.start_time > time
    );

    const selected = active || upcoming || null;

    return res.json({
      ok: true,
      date,
      time,

      live: Boolean(active),

      item: selected,

      next: upcoming || null,
    });
  } catch (error) {
    console.error(
      "Device current exception:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Failed to load device state",
    });
  }
});

// --------------------------------------------------
// GENERATE LESSON FOR SCHEDULED ITEM
// Login-free
// --------------------------------------------------

deviceRouter.post("/lesson", async (req, res) => {
  try {
    const { scheduleItemId } = req.body || {};

    if (!scheduleItemId) {
      return res.status(400).json({
        ok: false,
        error: "scheduleItemId is required",
      });
    }

    // ----------------------------------------------
    // Load schedule item
    // ----------------------------------------------

    const {
      data: item,
      error: itemError,
    } = await supabaseAdmin
      .from("schedule_items")
      .select("*")
      .eq("id", scheduleItemId)
      .single();

    if (itemError || !item) {
      console.error(
        "Device lesson schedule lookup error:",
        itemError
      );

      return res.status(404).json({
        ok: false,
        error: "Schedule item not found",
      });
    }

    // ----------------------------------------------
    // Only lessons should be taught by robot
    // ----------------------------------------------

    if (item.item_type !== "lesson") {
      return res.json({
        ok: true,
        skipped: true,
        message:
          "This schedule item is not a lesson.",
        scheduleItem: item,
      });
    }

    // ----------------------------------------------
    // Student ID comes from planner metadata
    // ----------------------------------------------

    const studentId =
      item?.metadata?.student_id;

    if (!studentId) {
      return res.status(400).json({
        ok: false,
        error:
          "No student_id found in schedule item metadata",
      });
    }

    // ----------------------------------------------
    // Topic
    // ----------------------------------------------

    const topic =
      item.topic ||
      item.title ||
      "today's topic";

    // ----------------------------------------------
    // Build current student profile
    // ----------------------------------------------

    const profile =
      await buildStudentProfile(
        studentId,
        {
          topic,
        }
      );

    // ----------------------------------------------
    // Build adaptive teaching strategy
    // ----------------------------------------------

    const strategy =
      buildTeachingStrategy(
        profile,
        {
          topic,

          doubt:
            `Teach the scheduled topic "${topic}".`,

          objective:
            "Teach the scheduled topic clearly and adapt the explanation to the student's current learning profile. Do not switch topics.",
        }
      );

    // ----------------------------------------------
    // Generate lecture
    // ----------------------------------------------

    const lecture =
      await generateLecture({
        studentId,

        topic:
          strategy?.topic || topic,

        doubt:
          `Teach the scheduled topic "${topic}".`,

        objective:
          strategy?.objective ||
          "Teach the scheduled topic clearly.",

        profile,

        strategy,
      });

    return res.json({
      ok: true,

      scheduleItem: item,

      studentProfile: profile,

      strategy,

      lecture,
    });
  } catch (error) {
    console.error(
      "Device lesson generation error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Failed to generate lesson",
    });
  }
});

// --------------------------------------------------
// Export
// --------------------------------------------------

export default deviceRouter;
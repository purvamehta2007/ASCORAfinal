import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { buildStudentProfile } from "./studentProfile.js";
import { buildTeachingStrategy } from "./adaptiveTeachingEngine.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:00`;
}

function chooseItemType(strategy, index) {
  if (index === 0) return "lesson";

  if (
    strategy?.action === "RETEACH" ||
    strategy?.scaffolding === "high"
  ) {
    return "lesson";
  }

  if (strategy?.action === "PRACTICE") {
    return "resource";
  }

  return index % 3 === 0 ? "test" : "lesson";
}

function chooseDuration(strategy) {
  if (strategy?.pace === "slow") return 50;
  if (strategy?.pace === "fast") return 35;

  return 45;
}

/**
 * Generate an adaptive daily ASCORA plan.
 *
 * Topics are supplied by the curriculum layer.
 * Student learning signals determine priority and strategy.
 */
export async function generateDailyPlan({
  classroomId,
  studentId,
  topics,
  date = today(),
}) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client is not configured."
    );
  }

  if (!classroomId) {
    throw new Error("classroomId is required.");
  }

  if (!studentId) {
    throw new Error("studentId is required.");
  }

  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error(
      "No curriculum topics were provided."
    );
  }

  // ----------------------------------------------------------
  // 1. Build the student's current learning profile
  // ----------------------------------------------------------

  const profile = await buildStudentProfile(
    studentId
  );

  // ----------------------------------------------------------
  // 2. Generate adaptive strategy
  // ----------------------------------------------------------

  const strategy = buildTeachingStrategy(
    profile
  );

  // ----------------------------------------------------------
  // 3. Create planner run
  // ----------------------------------------------------------

  const { data: plannerRun, error: runError } =
    await supabaseAdmin
      .from("planner_runs")
      .insert({
        classroom_id: classroomId,
        planning_date: date,
        status: "running",
        inputs: {
          studentId,
          topics,
          profile,
          strategy,
        },
      })
      .select()
      .single();

  if (runError) {
    throw runError;
  }

  try {
    // --------------------------------------------------------
    // 4. Rank topics
    //
    // Topics with known misconceptions / lower mastery
    // should appear earlier.
    // --------------------------------------------------------

    const misconceptionText = JSON.stringify(
      profile?.misconceptions || []
    ).toLowerCase();

    const mastery =
      Number(profile?.mastery) || 0;

    const rankedTopics = [...topics].sort(
      (a, b) => {
        const aName = String(
          a?.title || a?.name || a
        ).toLowerCase();

        const bName = String(
          b?.title || b?.name || b
        ).toLowerCase();

        const aNeedsAttention =
          misconceptionText.includes(aName);

        const bNeedsAttention =
          misconceptionText.includes(bName);

        if (
          aNeedsAttention &&
          !bNeedsAttention
        ) {
          return -1;
        }

        if (
          !aNeedsAttention &&
          bNeedsAttention
        ) {
          return 1;
        }

        return 0;
      }
    );

    // --------------------------------------------------------
    // 5. Build schedule
    // --------------------------------------------------------

    let currentMinutes = 9 * 60;

    const schedule = rankedTopics.map(
      (topic, index) => {
        const topicName =
          topic?.title ||
          topic?.name ||
          String(topic);

        const duration =
          topic?.durationMinutes ||
          chooseDuration(strategy);

        const start = currentMinutes;

        const end =
          currentMinutes + duration;

        currentMinutes = end;

        const itemType =
          topic?.item_type ||
          chooseItemType(
            strategy,
            index
          );

        return {
          classroom_id: classroomId,

          title:
            topic?.title ||
            `ASCORA: ${topicName}`,

          description:
            `Automatically planned ${
              itemType
            } based on the student's current learning profile.`,

          item_type: itemType,

          topic: topicName,

          scheduled_date: date,

          start_time: timeString(start),

          end_time: timeString(end),

          status: "scheduled",

          source: "planner",

          metadata: {
            automated: true,
            student_id: studentId,

            mastery,

            strategy: {
              difficulty:
                strategy?.difficulty ||
                null,

              pace:
                strategy?.pace ||
                null,

              scaffolding:
                strategy?.scaffolding ||
                null,

              visualSupport:
                strategy?.visualSupport ??
                null,
            },

            planning_reason:
              strategy?.action ||
              "ADAPTIVE_PLAN",
          },
        };
      }
    );

    // --------------------------------------------------------
    // 6. Remove previous automated plan
    // --------------------------------------------------------

    const {
      error: deleteError,
    } = await supabaseAdmin
      .from("schedule_items")
      .delete()
      .eq("classroom_id", classroomId)
      .eq("scheduled_date", date)
      .eq("source", "planner");

    if (deleteError) {
      throw deleteError;
    }

    // --------------------------------------------------------
    // 7. Store new schedule
    // --------------------------------------------------------

    const {
      data: insertedItems,
      error: insertError,
    } = await supabaseAdmin
      .from("schedule_items")
      .insert(schedule)
      .select();

    if (insertError) {
      throw insertError;
    }

    // --------------------------------------------------------
    // 8. Complete planner run
    // --------------------------------------------------------

    await supabaseAdmin
      .from("planner_runs")
      .update({
        status: "completed",

        output: {
          schedule: insertedItems,

          studentProfile: profile,

          adaptiveStrategy: strategy,

          count: insertedItems.length,
        },
      })
      .eq("id", plannerRun.id);

    return {
      plannerRunId: plannerRun.id,

      date,

      studentId,

      studentProfile: profile,

      adaptiveStrategy: strategy,

      schedule: insertedItems,
    };
  } catch (error) {
    await supabaseAdmin
      .from("planner_runs")
      .update({
        status: "failed",

        output: {
          error: error.message,
        },
      })
      .eq("id", plannerRun.id);

    throw error;
  }
}
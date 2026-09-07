import { chat } from "./aiProvider.js";

/**
 * Generate an adaptive answer for a student's doubt.
 *
 * The caller should provide learning context derived
 * from the trusted server-side student profile.
 */
export async function generateAdaptiveAnswer({
  doubt,
  student_context = {},
}) {
  if (
    !doubt ||
    typeof doubt !== "string" ||
    !doubt.trim()
  ) {
    throw new Error(
      "A valid student doubt is required."
    );
  }

  const context = {
    topic:
      student_context.topic ||
      "Unknown",

    mastery:
      student_context.mastery ??
      "Unknown",

    pace:
      student_context.pace ||
      student_context.learningPace ||
      "normal",

    difficulty:
      student_context.difficulty ??
      student_context.difficultyLevel ??
      "moderate",

    scaffolding:
      student_context.scaffolding ||
      student_context.scaffoldingLevel ||
      "medium",

    visualSupport:
      student_context.visualSupport ??
      student_context.visual ??
      false,

    misconceptions:
      Array.isArray(
        student_context.misconceptions
      )
        ? student_context.misconceptions
        : [],
  };

  return await chat({
    message: doubt.trim(),
    context,
  });
}
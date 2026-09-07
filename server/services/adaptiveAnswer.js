import { chat } from "./aiProvider.js";

/**
 * Generate an adaptive answer for a student's doubt.
 *
 * The route already provides the student's learning context.
 * This service forwards that context to the AI provider.
 */
export async function generateAdaptiveAnswer({
  doubt,
  student_context = {},
}) {
  if (!doubt || typeof doubt !== "string") {
    throw new Error("A valid doubt is required.");
  }

  const context = {
    topic: student_context.topic || "Unknown",
    mastery: student_context.mastery ?? "Unknown",
    pace: student_context.pace || "normal",
    difficulty: student_context.difficulty || "moderate",

    scaffolding:
      student_context.scaffolding ||
      student_context.scaffoldingLevel ||
      "medium",

    visualSupport:
      student_context.visualSupport ??
      student_context.visual ??
      false,

    misconceptions:
      Array.isArray(student_context.misconceptions)
        ? student_context.misconceptions
        : Array.isArray(student_context.errors)
        ? student_context.errors
        : [],
  };

  return await chat({
    message: doubt.trim(),
    context,
  });
}
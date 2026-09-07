export function detectMisconception({
  question = "",
  answer = "",
  correct = false,
  concept = "",
}) {
  // Correct answer = no misconception
  if (correct) {
    return null;
  }

  const q =
    String(question)
      .toLowerCase();

  const a =
    String(answer)
      .toLowerCase()
      .trim();

  const c =
    String(concept)
      .toLowerCase();

  // ==========================================
  // PHOTOSYNTHESIS
  // ==========================================

  if (
    c.includes("photosynthesis")
  ) {
    if (
      a.includes("oxygen") &&
      !a.includes("carbon")
    ) {
      return {
        type:
          "photosynthesis_gas_confusion",

        severity:
          "medium",

        recommended_intervention:
          "visual_process_diagram",

        explanation:
          "Student may be confusing the gas used during photosynthesis with the gas released.",
      };
    }

    return {
      type:
        "photosynthesis_conceptual_error",

      severity:
        "medium",

      recommended_intervention:
        "visual_process_diagram",

      explanation:
        "Student requires a visual explanation of the photosynthesis process.",
    };
  }

  // ==========================================
  // FRACTIONS
  // ==========================================

  if (
    c.includes("fraction")
  ) {
    return {
      type:
        "fraction_conceptual_error",

      severity:
        "medium",

      recommended_intervention:
        "visual_fraction_model",

      explanation:
        "Student may need a visual representation of fractions.",
    };
  }

  // ==========================================
  // EQUATIONS
  // ==========================================

  if (
    c.includes("equation") ||
    q.includes("solve for x")
  ) {
    return {
      type:
        "equation_solving_error",

      severity:
        "medium",

      recommended_intervention:
        "step_by_step_guidance",

      explanation:
        "Student may need guided steps for solving the equation.",
    };
  }

  // ==========================================
  // DEFAULT
  // ==========================================

  return {
    type:
      "conceptual_error",

    severity:
      "low",

    recommended_intervention:
      "worked_example",

    explanation:
      "Student answered incorrectly and should receive another explanation and a follow-up question.",
  };
}
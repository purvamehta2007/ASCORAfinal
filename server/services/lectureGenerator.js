// ============================================================
// ASCORA Personalized Multimodal Lecture Generator
// ============================================================
//
// Converts:
//   student profile
//   adaptive strategy
//   topic
//   student doubt
//
// into a structured adaptive lecture.
//
// The lecture can contain:
//   - spoken explanations
//   - AI-generated personalized visual instructions
//   - animated lessons
//   - worked examples
//   - remediation videos
//   - checkpoints
//   - recap
//
// The existing chat() adapter from aiProvider.js is preserved.
// ============================================================

import { chat } from "./aiProvider.js";

// ============================================================
// Topic → visual category
// ============================================================

function inferVisualType(topic = "") {
  const t = topic.toLowerCase();

  if (
    t.includes("equation") ||
    t.includes("algebra") ||
    t.includes("variable")
  ) {
    return "equation_steps";
  }

  if (
    t.includes("fraction") ||
    t.includes("ratio")
  ) {
    return "fraction_model";
  }

  if (
    t.includes("geometry") ||
    t.includes("triangle") ||
    t.includes("angle") ||
    t.includes("circle")
  ) {
    return "geometry_shape";
  }

  if (
    t.includes("physics") ||
    t.includes("force") ||
    t.includes("motion") ||
    t.includes("velocity") ||
    t.includes("acceleration")
  ) {
    return "physics_vectors";
  }

  return "concept_flow";
}

// ============================================================
// Difficulty normalization
// ============================================================

function normalizeDifficulty(difficulty) {
  if (
    difficulty === "advanced" ||
    difficulty === "hard"
  ) {
    return "advanced";
  }

  if (
    difficulty === "intermediate" ||
    difficulty === "medium"
  ) {
    return "intermediate";
  }

  return "beginner";
}

// ============================================================
// Controlled video library
// ============================================================
//
// These are intentionally controlled by ASCORA.
// The LLM should NOT invent external video URLs.
//
// Put your actual MP4 files in:
// public/videos/
//
// ============================================================

const VIDEO_LIBRARY = [
  {
    id: "linear_equations_intro",

    title:
      "Understanding Linear Equations",

    topicKeywords: [
      "equation",
      "algebra",
      "variable",
    ],

    misconceptionTypes: [
      "equation_manipulation",
      "coefficient_handling",
    ],

    duration: 45,

    url:
      "/videos/linear-equations-intro.mp4",
  },

  {
    id: "fractions_intro",

    title:
      "Understanding Fractions",

    topicKeywords: [
      "fraction",
      "ratio",
    ],

    misconceptionTypes: [
      "fraction_operations",
      "denominator_confusion",
    ],

    duration: 40,

    url:
      "/videos/fractions-intro.mp4",
  },

  {
    id: "geometry_angles",

    title:
      "Understanding Angles",

    topicKeywords: [
      "geometry",
      "angle",
      "triangle",
    ],

    misconceptionTypes: [
      "angle_relationship",
      "geometry_reasoning",
    ],

    duration: 45,

    url:
      "/videos/geometry-angles.mp4",
  },

  {
    id: "physics_forces",

    title:
      "Understanding Forces",

    topicKeywords: [
      "physics",
      "force",
      "motion",
    ],

    misconceptionTypes: [
      "force_direction",
      "motion_reasoning",
    ],

    duration: 50,

    url:
      "/videos/physics-forces.mp4",
  },
];

// ============================================================
// Select remediation video
// ============================================================

function selectVideo(
  topic = "",
  misconception = null
) {
  const normalizedTopic =
    topic.toLowerCase();

  const candidates =
    VIDEO_LIBRARY.filter((video) =>
      video.topicKeywords.some(
        (keyword) =>
          normalizedTopic.includes(keyword)
      )
    );

  if (!candidates.length) {
    return null;
  }

  // Prefer a video directly connected
  // to the detected misconception.
  if (misconception?.type) {
    const matchingVideo =
      candidates.find((video) =>
        video.misconceptionTypes.includes(
          misconception.type
        )
      );

    if (matchingVideo) {
      return matchingVideo;
    }
  }

  return candidates[0];
}

// ============================================================
// Build standard visual
// ============================================================

function buildVisual(
  topic = "",
  misconception = null
) {
  const type = inferVisualType(topic);

  // ----------------------------------------------------------
  // Equation
  // ----------------------------------------------------------

  if (type === "equation_steps") {
    const coefficientIssue =
      misconception?.type ===
      "coefficient_handling";

    return {
      type: "equation_steps",

      data: {
        stages: coefficientIssue
          ? [
              "3x + 4 = 10",
              "3x = 6",
              "x = 2",
            ]
          : [
              "2x + 4 = 10",
              "2x = 6",
              "x = 3",
            ],

        highlight: coefficientIssue
          ? 1
          : 0,
      },
    };
  }

  // ----------------------------------------------------------
  // Fraction
  // ----------------------------------------------------------

  if (type === "fraction_model") {
    return {
      type: "fraction_model",

      data: {
        numerator: 1,
        denominator: 2,
        label: "One half",
      },
    };
  }

  // ----------------------------------------------------------
  // Geometry
  // ----------------------------------------------------------

  if (type === "geometry_shape") {
    return {
      type: "geometry_shape",

      data: {
        shape: "triangle",
        labels: ["A", "B", "C"],
      },
    };
  }

  // ----------------------------------------------------------
  // Physics
  // ----------------------------------------------------------

  if (type === "physics_vectors") {
    return {
      type: "physics_vectors",

      data: {
        vectors: [
          {
            label: "Applied force",
            direction: "right",
          },
          {
            label: "Reaction",
            direction: "left",
          },
        ],
      },
    };
  }

  // ----------------------------------------------------------
  // Generic concept
  // ----------------------------------------------------------

  return {
    type: "concept_flow",

    data: {
      title:
        topic || "Key concept",

      steps: [
        "Understand the concept",
        "Apply the idea",
        "Check the result",
      ],
    },
  };
}

// ============================================================
// Build AI-personalized animated visual
// ============================================================

function buildAnimatedLesson({
  topic = "",
  doubt = "",
  misconception = null,
  difficulty = "beginner",
}) {
  const normalizedTopic =
    topic.toLowerCase();

  // ----------------------------------------------------------
  // Linear equations
  // ----------------------------------------------------------

  if (
    normalizedTopic.includes("equation") ||
    normalizedTopic.includes("algebra") ||
    normalizedTopic.includes("variable")
  ) {
    const coefficientIssue =
      misconception?.type ===
      "coefficient_handling";

    const equation =
      coefficientIssue
        ? "3x + 4 = 10"
        : "2x + 4 = 10";

    const steps =
      coefficientIssue
        ? [
            {
              equation:
                "3x + 4 = 10",

              action:
                "Start with the original equation",

              explanation:
                "The 3 is the coefficient. It means 3 times x.",
            },

            {
              equation:
                "3x = 6",

              action:
                "Subtract 4 from both sides",

              explanation:
                "The 4 disappears from the left side, while 10 minus 4 gives 6.",
            },

            {
              equation:
                "x = 2",

              action:
                "Divide both sides by 3",

              explanation:
                "Dividing by the coefficient isolates x.",
            },
          ]
        : [
            {
              equation:
                equation,

              action:
                "Start with the equation",

              explanation:
                "We want to isolate the variable.",
            },

            {
              equation:
                "2x = 6",

              action:
                "Subtract 4 from both sides",

              explanation:
                "The +4 is cancelled by subtracting 4.",
            },

            {
              equation:
                "x = 3",

              action:
                "Divide both sides by 2",

              explanation:
                "Dividing by the coefficient isolates x.",
            },
          ];

    return {
      type: "animated_lesson",

      data: {
        title: coefficientIssue
          ? "Understanding the coefficient"
          : "Solving a linear equation",

        equation,

        steps,

        autoPlay: true,

        stepDuration:
          difficulty === "beginner"
            ? 4500
            : difficulty === "intermediate"
            ? 3500
            : 2500,

        personalizedFor:
          misconception?.type ||
          "general understanding",

        sourceDoubt: doubt,
      },
    };
  }

  // ----------------------------------------------------------
  // Fractions
  // ----------------------------------------------------------

  if (
    normalizedTopic.includes(
      "fraction"
    ) ||
    normalizedTopic.includes("ratio")
  ) {
    return {
      type: "animated_lesson",

      data: {
        title:
          "Understanding fractions",

        steps: [
          {
            action:
              "Look at the denominator",

            explanation:
              "The denominator tells us how many equal parts make the whole.",
          },

          {
            action:
              "Look at the numerator",

            explanation:
              "The numerator tells us how many of those parts we have.",
          },

          {
            action:
              "Connect the two",

            explanation:
              "Together they describe how much of the whole we are using.",
          },
        ],

        autoPlay: true,

        stepDuration:
          difficulty === "beginner"
            ? 4500
            : 3000,
      },
    };
  }

  // ----------------------------------------------------------
  // Generic concept
  // ----------------------------------------------------------

  return {
    type: "animated_lesson",

    data: {
      title:
        `Understanding ${
          topic || "the concept"
        }`,

      steps: [
        {
          action:
            "Understand the main idea",

          explanation:
            doubt ||
            `Let's understand ${
              topic || "this concept"
            } step by step.`,
        },

        {
          action:
            "Apply the concept",

          explanation:
            "Let's use the idea in a simple example.",
        },

        {
          action:
            "Check your understanding",

          explanation:
            "Now let's see if you can apply it yourself.",
        },
      ],

      autoPlay: true,

      stepDuration:
        difficulty === "beginner"
          ? 4500
          : 3000,
    },
  };
}

// ============================================================
// Expected checkpoint concept
// ============================================================

function expectedConceptFor(
  topic = "",
  misconception = null
) {
  const t = topic.toLowerCase();

  if (
    t.includes("equation") ||
    t.includes("algebra") ||
    t.includes("variable")
  ) {
    return (
      "perform the same inverse operation on both sides of the equation to isolate the variable"
    );
  }

  if (t.includes("fraction")) {
    return (
      "find a common denominator or use an equivalent fraction"
    );
  }

  if (
    t.includes("geometry") ||
    t.includes("triangle") ||
    t.includes("angle")
  ) {
    return (
      "identify the given angle, side, or vertex relationship"
    );
  }

  if (
    t.includes("physics") ||
    t.includes("force") ||
    t.includes("motion")
  ) {
    return (
      "identify the forces and directions acting on the object"
    );
  }

  return (
    misconception?.concept ||
    topic ||
    "the key idea"
  );
}

// ============================================================
// Lecture validation
// ============================================================

const STEP_TYPES = [
  "explanation",
  "example",
  "checkpoint",
  "recap",
];

export function validateLecture(
  lecture
) {
  if (
    !lecture ||
    typeof lecture !== "object"
  ) {
    return false;
  }

  if (
    !Array.isArray(lecture.steps) ||
    lecture.steps.length === 0
  ) {
    return false;
  }

  return lecture.steps.every(
    (step) => {
      if (
        !step ||
        typeof step !== "object"
      ) {
        return false;
      }

      if (
        !STEP_TYPES.includes(step.type)
      ) {
        return false;
      }

      if (
        typeof step.speech !== "string" ||
        !step.speech.trim()
      ) {
        return false;
      }

      if (
        step.type === "checkpoint"
      ) {
        return (
          typeof step.question ===
            "string" &&
          step.question.trim()
            .length > 0
        );
      }

      return true;
    }
  );
}

// ============================================================
// Fallback lecture
// ============================================================

function buildFallbackLecture({
  topic,
  doubt,
  strategy,
}) {
  const misconception =
    strategy?.misconception ||
    null;

  const difficulty =
    normalizeDifficulty(
      strategy?.difficulty
    );

  const animatedVisual =
    buildAnimatedLesson({
      topic,
      doubt,
      misconception,
      difficulty,
    });

  const normalVisual =
    buildVisual(
      topic,
      misconception
    );

  const video =
    strategy?.visualSupport !== false
      ? selectVideo(
          topic,
          misconception
        )
      : null;

  const steps = [
    {
      id: "step1",

      type: "explanation",

      speech:
        `Let's work through your question about ${
          topic || "this topic"
        } step by step.`,

      visual:
        animatedVisual,
    },

    {
      id: "step2",

      type: "example",

      speech:
        `Let's try a simple example related to ${
          topic || "this topic"
        }.`,

      visual:
        normalVisual,
    },
  ];

  if (video) {
    steps.push({
      id: "video1",

      type: "example",

      speech:
        "Let's use a short visual explanation to reinforce this idea.",

      visual: {
        type: "video",

        data: {
          id: video.id,
          title: video.title,
          url: video.url,
          duration: video.duration,
        },
      },
    });
  }

  const checkpointQuestion =
    strategy?.questioningStyle ===
    "independent"
      ? "Now try a similar problem on your own. What is your answer?"
      : "Let's do the next step together. What should we do first?";

  steps.push({
    id: "step3",

    type: "checkpoint",

    speech:
      checkpointQuestion,

    question:
      checkpointQuestion,

    expectedConcept:
      expectedConceptFor(
        topic,
        misconception
      ),
  });

  steps.push({
    id: "step4",

    type: "recap",

    speech:
      `To recap, we worked through ${
        topic || "this topic"
      } step by step.`,

    visual:
      normalVisual,
  });

  return {
    title:
      `Understanding ${
        topic || "this topic"
      }`,

    objective:
      strategy?.objective ||
      `Understand ${
        topic || "the topic"
      }`,

    strategy: {
      difficulty,

      pace:
        strategy?.pace || "slow",

      scaffolding:
        strategy?.scaffolding || "high",

      visualSupport:
        strategy?.visualSupport ??
        true,
    },

    personalization: {
      misconception:
        misconception?.type ||
        null,

      adaptive: true,
    },

    fallback: true,

    steps,
  };
}
// ============================================================
// MAIN GENERATOR
// ============================================================

export async function generateLecture({
  studentId,
  topic,
  doubt,
  objective,
  profile = {},
  strategy = {},
  assessmentSignals = {},
}) {
  try {
    // --------------------------------------------------------
    // Student adaptation context
    // --------------------------------------------------------

    const misconception =
      strategy?.misconception ||
      null;

    const difficulty =
      normalizeDifficulty(
        strategy?.difficulty
      );

    const visualSupport =
      strategy?.visualSupport ??
      true;

    // Assessment data is evidence, not a replacement
    // for the student profile.
    //
    // It lets ASCORA target the misconception
    // actually observed in assessment.

    const assessment = {
      mastery:
        assessmentSignals?.mastery ??
        profile?.mastery ??
        null,

      misconception:
        assessmentSignals?.misconception ??
        misconception ??
        null,

      recentPerformance:
        assessmentSignals?.recentPerformance ??
        null,

      evidence:
        Array.isArray(
          assessmentSignals?.evidence
        )
          ? assessmentSignals.evidence
          : Array.isArray(
              assessmentSignals?.misconception
                ?.evidence
            )
          ? assessmentSignals.misconception
              .evidence
          : [],

      recentAttempts:
        Array.isArray(
          assessmentSignals?.recentAttempts
        )
          ? assessmentSignals.recentAttempts
          : [],
    };

    const effectiveMisconception =
      assessment?.misconception ||
      misconception ||
      null;

    const learningContext = {
      topic,

      studentId,

      mastery:
        profile?.mastery ??
        null,

      pace:
        strategy?.pace ||
        "normal",

      difficulty,

      scaffolding:
        strategy?.scaffolding ||
        "medium",

      visualSupport,

      misconception:
        effectiveMisconception?.type ||
        null,

      assessmentSignals:
        assessment,
    };

    // --------------------------------------------------------
    // Create personalized animated visual
    // --------------------------------------------------------

    const animatedVisual =
      buildAnimatedLesson({
        topic,
        doubt,
        misconception:
          effectiveMisconception,
        difficulty,
      });

    const standardVisual =
      buildVisual(
        topic,
        effectiveMisconception
      );

    // --------------------------------------------------------
    // Explanation
    // --------------------------------------------------------

    const explanationMessage =
      misconception
        ? `
Explain ${topic || "this topic"} specifically to address the student's misconception.

Student's doubt:
${doubt || "No doubt provided"}

Assessment evidence:
${JSON.stringify(
  assessment.evidence.slice(0, 6)
)}

Recent performance:
${JSON.stringify(
  assessment.recentPerformance
)}

Misconception:
${effectiveMisconception.type?.replaceAll(
  "_",
  " "
)}

Teaching level:
${difficulty}

Teaching pace:
${strategy?.pace || "normal"}

Scaffolding:
${strategy?.scaffolding || "medium"}

Important:
- Explain the student's exact confusion.
- Do not assume the student already understands the concept.
- Use simple spoken language.
- Avoid unnecessary Markdown.
- Avoid tables.
- Avoid LaTeX.
- Make the response suitable for text-to-speech.
- Keep it concise enough for a robot teacher to speak naturally.
`
        : `
Explain ${topic || "this topic"} clearly.

Student's doubt:
${doubt || "No doubt provided"}

Teaching level:
${difficulty}

Scaffolding:
${strategy?.scaffolding || "medium"}

Important:
- Use natural spoken language.
- Avoid Markdown tables.
- Avoid LaTeX.
- Keep it suitable for text-to-speech.
`;

    const explanationText =
      await chat({
        message:
          explanationMessage,

        context:
          learningContext,
      });

    // --------------------------------------------------------
    // Example
    // --------------------------------------------------------

    const exampleText =
      await chat({
        message: `
Give one ${difficulty}-level worked example for ${
          topic || "this topic"
        }.

Student doubt:
${doubt || "No doubt provided"}

Assessment evidence:
${JSON.stringify(
  assessment.evidence.slice(0, 6)
)}

${
  effectiveMisconception
    ? `The student previously struggled with:
${effectiveMisconception.type?.replaceAll(
  "_",
  " "
)}`
    : ""
}

Explain the reasoning step by step.

Important:
- Keep it concise.
- Use natural spoken language.
- Do not use Markdown tables.
- Do not use LaTeX.
- Make it suitable for text-to-speech.
`,

        context:
          learningContext,
      });

    // --------------------------------------------------------
    // Checkpoint
    // --------------------------------------------------------

    let checkpointQuestion;

    if (
      strategy?.questioningStyle ===
      "independent"
    ) {
      checkpointQuestion =
        `Now try a similar problem on your own. What is your answer?`;
    } else if (
      strategy?.questioningStyle ===
      "guided"
    ) {
      checkpointQuestion =
        `Let's do the next step together. What should we do first?`;
    } else {
      checkpointQuestion =
        `What should we do first to solve this ${
          topic || "problem"
        }?`;
    }

    const expectedConcept =
      expectedConceptFor(
        topic,
        effectiveMisconception
      );

    // --------------------------------------------------------
    // Recap
    // --------------------------------------------------------

    const recapText =
      `To recap, we learned ${
        topic || "this concept"
      }${
        misconception
          ? ` and focused on avoiding the ${
              misconception.type?.replaceAll(
                "_",
                " "
              )
            } mistake`
          : ""
      }.`;

    // --------------------------------------------------------
    // Optional remediation video
    // --------------------------------------------------------

    const remediationVideo =
      visualSupport
        ? selectVideo(
            topic,
            misconception
          )
        : null;

    // --------------------------------------------------------
    // Lecture steps
    // --------------------------------------------------------

    const steps = [
      {
        id: "step1",

        type: "explanation",

        speech:
          explanationText,

        visual:
          visualSupport
            ? animatedVisual
            : null,
      },

      {
        id: "step2",

        type: "example",

        speech:
          exampleText,

        visual:
          visualSupport
            ? standardVisual
            : null,
      },
    ];

    // --------------------------------------------------------
    // Add personalized remediation video
    // --------------------------------------------------------

    if (remediationVideo) {
      steps.push({
        id: "video1",

        type: "example",

        speech:
          "Let's use a short visual explanation to reinforce this idea.",

        visual: {
          type: "video",

          data: {
            id:
              remediationVideo.id,

            title:
              remediationVideo.title,

            url:
              remediationVideo.url,

            duration:
              remediationVideo.duration,
          },
        },
      });
    }

    // --------------------------------------------------------
    // Checkpoint
    // --------------------------------------------------------

    steps.push({
      id: "step3",

      type: "checkpoint",

      speech:
        checkpointQuestion,

      question:
        checkpointQuestion,

      expectedConcept,
    });

    // --------------------------------------------------------
    // Recap
    // --------------------------------------------------------

    steps.push({
      id: "step4",

      type: "recap",

      speech:
        recapText,

      visual:
        visualSupport
          ? standardVisual
          : null,
    });

    // --------------------------------------------------------
    // Final lecture
    // --------------------------------------------------------

    const lecture = {
      title:
        `Personalized lesson: ${
          topic || "Your question"
        }`,

      objective:
        objective ||
        `Understand ${
          topic || "the topic"
        }`,

      strategy: {
        difficulty,

        pace:
          strategy?.pace,

        scaffolding:
          strategy?.scaffolding,

        visualSupport,

        videoSupport:
          strategy?.videoSupport ??
          true,
      },

      personalization: {
        adaptive: true,

        misconception:
          effectiveMisconception?.type ||
          null,

        mastery:
          assessment?.mastery ??
          null,

        assessmentDriven:
          assessment.evidence.length > 0,

        evidenceCount:
          assessment.evidence.length,

        difficulty,
      },

      fallback: false,

      steps,
    };

    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (
      !validateLecture(lecture)
    ) {
      console.error(
        "Generated lecture failed validation. Using fallback."
      );

      return buildFallbackLecture({
        topic,
        doubt,
        strategy,
      });
    }

    return lecture;

  } catch (error) {
    console.error(
      "Lecture generation error:",
      error
    );

    return buildFallbackLecture({
      topic,
      doubt,
      strategy,
    });
  }
}
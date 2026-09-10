import React, { useEffect, useState } from "react";

// ============================================================
// Shared helpers
// ============================================================

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// ============================================================
// Existing equation visual
// ============================================================

function EquationSteps({ data = {} }) {
  const stages = Array.isArray(data.stages)
    ? data.stages
    : [];

  const highlight =
    typeof data.highlight === "number"
      ? data.highlight
      : -1;

  return (
    <Card>
      <h3 className="mb-5 text-center text-xl font-semibold">
        Step-by-step equation
      </h3>

      <div className="space-y-3">
        {stages.map((stage, index) => (
          <React.Fragment key={index}>
            <div
              className={`rounded-xl border p-4 text-center transition-all ${
                index === highlight
                  ? "ring-2 ring-primary"
                  : ""
              }`}
            >
              <div className="mb-1 text-xs opacity-60">
                Step {index + 1}
              </div>

              <div className="text-2xl font-bold">
                {stage}
              </div>
            </div>

            {index < stages.length - 1 && (
              <div className="text-center text-xl opacity-60">
                ↓
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Fraction visual
// ============================================================

function FractionModel({ data = {} }) {
  const numerator = Number(data.numerator ?? 1);
  const denominator = Math.max(
    1,
    Number(data.denominator ?? 2)
  );

  const label =
    data.label ||
    `${numerator}/${denominator}`;

  return (
    <Card>
      <h3 className="mb-5 text-center text-xl font-semibold">
        Fraction model
      </h3>

      <div className="mx-auto max-w-md">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({
            length: denominator,
          }).map((_, index) => (
            <div
              key={index}
              className={`h-16 rounded-lg border ${
                index < numerator
                  ? "ring-2 ring-primary"
                  : ""
              }`}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-lg font-medium">
          {label}
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// Geometry visual
// ============================================================

function GeometryShape({ data = {} }) {
  const shape = data.shape || "triangle";
  const labels = Array.isArray(data.labels)
    ? data.labels
    : ["A", "B", "C"];

  return (
    <Card>
      <h3 className="mb-5 text-center text-xl font-semibold">
        Geometry
      </h3>

      <div className="flex justify-center">
        {shape === "triangle" ? (
          <svg
            viewBox="0 0 300 220"
            className="h-52 w-full max-w-md"
          >
            <polygon
              points="150,25 35,190 265,190"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
            />

            <text
              x="145"
              y="18"
              fontSize="18"
            >
              {labels[0] || "A"}
            </text>

            <text
              x="20"
              y="210"
              fontSize="18"
            >
              {labels[1] || "B"}
            </text>

            <text
              x="265"
              y="210"
              fontSize="18"
            >
              {labels[2] || "C"}
            </text>
          </svg>
        ) : (
          <div className="rounded-xl border p-10 text-center">
            {shape}
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Concept flow
// ============================================================

function ConceptFlow({ data = {} }) {
  const title =
    data.title || "Key concept";

  const steps = Array.isArray(data.steps)
    ? data.steps
    : [];

  return (
    <Card>
      <h3 className="mb-5 text-center text-xl font-semibold">
        {title}
      </h3>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={index}
            className="rounded-xl border p-4 text-center"
          >
            <div className="mb-1 text-xs opacity-60">
              Step {index + 1}
            </div>

            <div className="font-medium">
              {step}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Physics vectors
// ============================================================

function PhysicsVectors({ data = {} }) {
  const vectors = Array.isArray(data.vectors)
    ? data.vectors
    : [];

  return (
    <Card>
      <h3 className="mb-5 text-center text-xl font-semibold">
        Forces and directions
      </h3>

      <div className="space-y-4">
        {vectors.map((vector, index) => (
          <div
            key={index}
            className="flex items-center justify-center gap-4"
          >
            <span className="font-medium">
              {vector.label || "Vector"}
            </span>

            <span className="text-2xl">
              {vector.direction === "left"
                ? "←"
                : vector.direction === "up"
                ? "↑"
                : vector.direction === "down"
                ? "↓"
                : "→"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Simple equation
// ============================================================

function Equation({ data = {} }) {
  return (
    <Card>
      <div className="py-6 text-center text-4xl font-bold">
        {data.equation || data.text || ""}
      </div>
    </Card>
  );
}

// ============================================================
// Text / explanation
// ============================================================

function Explanation({ data = {} }) {
  return (
    <Card>
      {data.title && (
        <h3 className="mb-3 text-xl font-semibold">
          {data.title}
        </h3>
      )}

      <p className="whitespace-pre-wrap leading-7">
        {data.text ||
          data.explanation ||
          data.content ||
          ""}
      </p>
    </Card>
  );
}

// ============================================================
// Image visual
// ============================================================

function ImageVisual({ data = {} }) {
  if (!data.url) {
    return null;
  }

  return (
    <Card>
      <img
        src={data.url}
        alt={data.caption || data.title || "Learning visual"}
        className="mx-auto max-h-[420px] rounded-xl object-contain"
      />

      {data.caption && (
        <p className="mt-3 text-center text-sm opacity-70">
          {data.caption}
        </p>
      )}
    </Card>
  );
}

// ============================================================
// Video visual
// ============================================================

function VideoVisual({ data = {} }) {
  if (!data.url) {
    return (
      <Card>
        <p className="text-center opacity-70">
          No video is available for this lesson.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {data.title && (
        <h3 className="mb-4 text-center text-xl font-semibold">
          {data.title}
        </h3>
      )}

      <video
        controls
        playsInline
        preload="metadata"
        className="mx-auto w-full max-w-3xl rounded-xl"
      >
        <source
          src={data.url}
          type="video/mp4"
        />

        Your browser does not support video
        playback.
      </video>

      {data.duration && (
        <p className="mt-3 text-center text-sm opacity-60">
          {data.duration} second lesson
        </p>
      )}
    </Card>
  );
}

// ============================================================
// AI Personalized Animated Lesson
// ============================================================

function AnimatedLesson({ data = {} }) {
  const {
    title = "Interactive explanation",
    equation = "",
    steps = [],
    autoPlay = true,
    stepDuration = 3500,
  } = data;

  const [activeStep, setActiveStep] =
    useState(0);

  // ----------------------------------------------------------
  // Reset animation whenever a new lesson arrives
  // ----------------------------------------------------------

  useEffect(() => {
    setActiveStep(0);
  }, [title, equation, steps.length]);

  // ----------------------------------------------------------
  // Automatically move through the lesson
  // ----------------------------------------------------------

  useEffect(() => {
    if (!autoPlay || steps.length <= 1) {
      return;
    }

    const timer = setTimeout(() => {
      setActiveStep((current) => {
        if (current >= steps.length - 1) {
          return 0;
        }

        return current + 1;
      });
    }, stepDuration);

    return () => clearTimeout(timer);
  }, [
    activeStep,
    autoPlay,
    stepDuration,
    steps.length,
  ]);

  const current =
    steps[activeStep] || null;

  return (
    <Card className="overflow-hidden">
      {/* Title */}

      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold">
          {title}
        </h3>

        <p className="mt-1 text-sm opacity-60">
          Personalized explanation
        </p>
      </div>

      {/* Main equation */}

      {equation && (
        <div className="mb-6 rounded-2xl border p-6 text-center">
          <div className="text-4xl font-bold">
            {current?.equation || equation}
          </div>
        </div>
      )}

      {/* Current action */}

      {current?.action && (
        <div className="mb-4 text-center">
          <div className="text-lg font-semibold">
            {current.action}
          </div>
        </div>
      )}

      {/* Explanation */}

      {current?.explanation && (
        <div className="mb-6 rounded-xl border p-4 text-center">
          <p className="leading-7">
            {current.explanation}
          </p>
        </div>
      )}

      {/* Progress */}

      {steps.length > 0 && (
        <div className="mb-5 flex justify-center gap-2">
          {steps.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() =>
                setActiveStep(index)
              }
              aria-label={`Go to step ${
                index + 1
              }`}
              className={`h-2.5 w-2.5 rounded-full border transition-all ${
                index === activeStep
                  ? "scale-125 bg-primary"
                  : "opacity-30"
              }`}
            />
          ))}
        </div>
      )}

      {/* Step counter */}

      {steps.length > 0 && (
        <div className="text-center text-xs opacity-50">
          Step {activeStep + 1} of{" "}
          {steps.length}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Animated steps
// ============================================================

function AnimatedSteps({ data = {} }) {
  const steps = Array.isArray(data.steps)
    ? data.steps
    : [];

  const [activeStep, setActiveStep] =
    useState(0);

  useEffect(() => {
    setActiveStep(0);
  }, [steps.length]);

  useEffect(() => {
    if (steps.length <= 1) {
      return;
    }

    const timer = setTimeout(() => {
      setActiveStep((current) =>
        current >= steps.length - 1
          ? 0
          : current + 1
      );
    }, data.stepDuration || 3000);

    return () => clearTimeout(timer);
  }, [
    activeStep,
    steps.length,
    data.stepDuration,
  ]);

  const step = steps[activeStep];

  return (
    <Card>
      {data.title && (
        <h3 className="mb-5 text-center text-xl font-semibold">
          {data.title}
        </h3>
      )}

      {step && (
        <div className="rounded-xl border p-6 text-center">
          {step.title && (
            <div className="mb-2 text-sm opacity-60">
              {step.title}
            </div>
          )}

          {step.equation && (
            <div className="text-3xl font-bold">
              {step.equation}
            </div>
          )}

          {step.action && (
            <p className="mt-3 font-medium">
              {step.action}
            </p>
          )}

          {step.explanation && (
            <p className="mt-2 leading-7 opacity-80">
              {step.explanation}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 text-center text-xs opacity-50">
        Step {activeStep + 1} of{" "}
        {steps.length}
      </div>
    </Card>
  );
}

// ============================================================
// Renderer map
// ============================================================

const RENDERERS = {
  equation_steps: EquationSteps,
  fraction_model: FractionModel,
  geometry_shape: GeometryShape,
  concept_flow: ConceptFlow,
  physics_vectors: PhysicsVectors,

  equation: Equation,
  text: Explanation,
  explanation: Explanation,
  image: ImageVisual,
  video: VideoVisual,

  animated_steps: AnimatedSteps,
  animated_lesson: AnimatedLesson,
};

// ============================================================
// Main component
// ============================================================

export default function VisualLecture({
  visual,
}) {
  if (!visual) {
    return null;
  }

  const type = visual.type;
  const Renderer = RENDERERS[type];

  if (!Renderer) {
    return (
      <Card>
        <p className="text-center text-sm opacity-60">
          Visual type "{type}" is not supported yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <Renderer
        data={visual.data || {}}
      />
    </div>
  );
}
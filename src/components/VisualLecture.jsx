import React from "react";

// --------------------------------------------------
// EQUATION STEPS - vertical stage transform with an
// arrow between each stage, current stage highlighted.
// --------------------------------------------------

function EquationSteps({ data }) {
  const stages = data?.stages || [];
  const highlight = data?.highlight ?? stages.length - 1;

  return (
    <svg viewBox={`0 0 300 ${stages.length * 70}`} width="100%" height="220">
      {stages.map((stage, index) => (
        <g key={index}>
          <rect
            x={40}
            y={index * 70 + 8}
            width={220}
            height={44}
            rx={8}
            fill={index === highlight ? "#eef2ff" : "#f8fafc"}
            stroke={index === highlight ? "#6366f1" : "#cbd5e1"}
            strokeWidth={index === highlight ? 2 : 1}
          />
          <text
            x={150}
            y={index * 70 + 34}
            textAnchor="middle"
            fontSize="18"
            fontWeight={index === highlight ? "700" : "500"}
            fill={index === highlight ? "#3730a3" : "#334155"}
          >
            {stage}
          </text>
          {index < stages.length - 1 && (
            <text
              x={150}
              y={index * 70 + 65}
              textAnchor="middle"
              fontSize="18"
              fill="#94a3b8"
            >
              ↓
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// --------------------------------------------------
// FRACTION MODEL - a circle split into equal sectors,
// highlighting the numerator's worth of sectors.
// --------------------------------------------------

function FractionModel({ data }) {
  const numerator = data?.numerator ?? 3;
  const denominator = data?.denominator ?? 4;
  const radius = 70;
  const cx = 100;
  const cy = 100;

  const slices = Array.from({ length: denominator }, (_, i) => {
    const startAngle = (i / denominator) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / denominator) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;

    return (
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={i < numerator ? "#6366f1" : "#f1f5f9"}
        stroke="#ffffff"
        strokeWidth={2}
      />
    );
  });

  return (
    <svg viewBox="0 0 200 220" width="100%" height="220">
      {slices}
      <text x={100} y={205} textAnchor="middle" fontSize="16" fill="#334155">
        {numerator}/{denominator}
      </text>
    </svg>
  );
}

// --------------------------------------------------
// GEOMETRY SHAPE - a labeled triangle as a generic
// stand-in for angle/side/vertex highlighting.
// --------------------------------------------------

function GeometryShape({ data }) {
  const label = data?.label || "Triangle";

  return (
    <svg viewBox="0 0 260 200" width="100%" height="200">
      <polygon
        points="130,20 20,180 240,180"
        fill="#f8fafc"
        stroke="#6366f1"
        strokeWidth={2}
      />
      <circle cx={130} cy={20} r={4} fill="#6366f1" />
      <circle cx={20} cy={180} r={4} fill="#6366f1" />
      <circle cx={240} cy={180} r={4} fill="#6366f1" />
      <text x={130} y={195} textAnchor="middle" fontSize="14" fill="#334155">
        {label}
      </text>
    </svg>
  );
}

// --------------------------------------------------
// GENERIC CONCEPT FLOW - stage labels connected by
// arrows, used for any subject without a dedicated
// visual (extensible per Part 7).
// --------------------------------------------------

function ConceptFlow({ data }) {
  const stages = data?.stages || ["Concept"];
  const highlight = data?.highlight ?? stages.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {stages.map((stage, index) => (
        <React.Fragment key={index}>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${
                index === highlight ? "#6366f1" : "#cbd5e1"
              }`,
              background: index === highlight ? "#eef2ff" : "#f8fafc",
              fontWeight: index === highlight ? 700 : 500,
              color: index === highlight ? "#3730a3" : "#334155",
            }}
          >
            {stage}
          </div>
          {index < stages.length - 1 && (
            <div style={{ textAlign: "center", color: "#94a3b8" }}>↓</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const RENDERERS = {
  equation_steps: EquationSteps,
  fraction_model: FractionModel,
  geometry_shape: GeometryShape,
  concept_flow: ConceptFlow,
  physics_vectors: ConceptFlow,
};

// --------------------------------------------------
// VisualLecture - renders whatever visual the current
// lecture step specifies. Returns null when the step
// has no visual (e.g. scaffolding is low and
// visualSupport is off), so callers can render it
// unconditionally.
// --------------------------------------------------

export default function VisualLecture({ visual }) {
  if (!visual || !visual.type) return null;

  const Renderer = RENDERERS[visual.type] || ConceptFlow;

  return (
    <div
      className="item"
      style={{
        marginTop: 12,
        textAlign: "center",
        background: "#ffffff",
      }}
    >
      <Renderer data={visual.data || {}} />
    </div>
  );
}

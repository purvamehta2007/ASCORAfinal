import React from "react";

export default function Dashboard({ student = null }) {
  const topics = [
    ["Fractions", 82],
    ["Linear Equations", 43],
    ["Geometry", 67],
  ];

  // Safely get the student's name.
  // The dashboard will still render even if
  // the parent has not loaded the profile yet.
  const studentName =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  return (
    <div>
      {/* ================================
          WELCOME SECTION
      ================================= */}

      <section className="hero">
        <span className="pill">
          Adaptive learning
        </span>

        <h1>
          Good to see you, {studentName}.
        </h1>

        <p className="muted">
          ASCORA uses your assessment and
          interaction history to decide how
          to teach you next.
        </p>
      </section>

      {/* ================================
          KEY METRICS
      ================================= */}

      <div
        className="grid grid-3"
        style={{ marginTop: 16 }}
      >
        <div className="card">
          <div className="muted">
            Overall mastery
          </div>

          <div className="stat">
            64%
          </div>

          <span className="pill">
            ↑ 8% this week
          </span>
        </div>

        <div className="card">
          <div className="muted">
            Learning streak
          </div>

          <div className="stat">
            7 days
          </div>

          <span className="pill">
            Keep going
          </span>
        </div>

        <div className="card">
          <div className="muted">
            Next intervention
          </div>

          <div className="stat">
            Algebra
          </div>

          <span className="pill">
            Visual + guided
          </span>
        </div>
      </div>

      {/* ================================
          LOWER DASHBOARD
      ================================= */}

      <div
        className="grid grid-2"
        style={{ marginTop: 16 }}
      >
        {/* CONCEPT MASTERY */}

        <div className="card">
          <h2>
            Concept mastery
          </h2>

          {topics.map(([topic, value]) => (
            <div
              key={topic}
              style={{
                margin: "18px 0",
              }}
            >
              <div className="kpi">
                <span>
                  {topic}
                </span>

                <strong>
                  {value}%
                </strong>
              </div>

              <div className="progress">
                <div
                  style={{
                    width: `${value}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* WHY ASCORA ADAPTS */}

        <div className="card">
          <h2>
            Why ASCORA adapts
          </h2>

          <div className="list">
            <div className="item">
              Linear equations: repeated
              inverse-operation errors.
            </div>

            <div className="item">
              Response time is higher on
              multi-step equations.
            </div>

            <div className="item">
              Visual examples have produced
              better recent accuracy.
            </div>

            <div className="item">
              <strong>
                Recommendation:
              </strong>{" "}
              slow pace + worked example +
              guided question.
            </div>
          </div>
        </div>
      </div>

      {/* ================================
          STUDENT DATA STATUS
      ================================= */}

      {!student && (
        <div
          className="card"
          style={{
            marginTop: 16,
          }}
        >
          <p className="muted">
            Student profile is still loading.
            Your dashboard data will appear
            once the profile is available.
          </p>
        </div>
      )}
    </div>
  );
}

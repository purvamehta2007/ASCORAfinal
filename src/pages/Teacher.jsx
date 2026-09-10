import React, { useEffect, useState } from "react";
import { Brain, CheckCircle2, Radio, Sparkles, BookOpen } from "lucide-react";

import { supabase } from "../lib/supabase";

export default function Teacher({ onNavigateToAscora } = {}) {
  const [teacherId, setTeacherId] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeacher() {
    setLoadingUser(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setError("No signed-in facilitator account was found.");
        return;
      }

      setTeacherId(user.id);
    } catch (err) {
      console.error("Failed to load facilitator:", err);
      setError(err.message || "Could not identify the logged-in facilitator.");
    } finally {
      setLoadingUser(false);
    }
  }

  const handleStartAscora = onNavigateToAscora
    ? onNavigateToAscora
    : () => {
        window.location.href = "/ascora";
      };

  if (loadingUser) {
    return (
      <div style={styles.loading}>
        <Sparkles size={22} />
        Loading facilitator dashboard...
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Facilitator control center</div>
          <h1 style={styles.title}>Facilitator Dashboard</h1>
          <p style={styles.subtitle}>
            Start ASCORA to teach the current planner-scheduled lesson, and
            keep an eye on how the class is doing.
          </p>
        </div>

        <div style={styles.ctaBlock}>
          <button
            style={styles.robotButton}
            onClick={handleStartAscora}
            disabled={!teacherId}
          >
            <Radio size={18} />
            Start ASCORA
          </button>
          <span style={styles.ctaHint}>
            Teaches the lesson currently active on the Planner
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ ...styles.status, ...styles.statusError }}>
          ⚠ {error}
        </div>
      )}

      <StudentInsights />
    </div>
  );
}

function StudentInsights() {
  return (
    <>
      <div style={styles.card}>
        <div style={styles.eyebrow}>Student intelligence</div>
        <h2 style={styles.sectionTitle}>Class Learning Insights</h2>
        <p style={styles.muted}>
          Identify where the class is struggling and what intervention ASCORA
          should use.
        </p>

        <div style={styles.insightTable}>
          <div style={styles.tableHeader}>
            <span>Concept</span>
            <span>Students affected</span>
            <span>Suggested intervention</span>
          </div>

          <InsightTableRow
            topic="Linear Equations"
            students="11"
            intervention="Visual balance model + guided practice"
          />
          <InsightTableRow
            topic="Fractions"
            students="8"
            intervention="Equivalent-fraction visual exercise"
          />
          <InsightTableRow
            topic="Geometry"
            students="5"
            intervention="Diagram-first explanation"
          />
          <InsightTableRow
            topic="Electric Current"
            students="4"
            intervention="Circuit visual + concept recap"
          />
        </div>
      </div>

      <div style={styles.twoColumn}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Class Mastery</h3>
          <div style={styles.masteryCircle}>68%</div>
          <p style={styles.muted}>
            Overall estimated mastery across currently tracked concepts.
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Recommended Action</h3>
          <div style={styles.recommendation}>
            <Brain size={22} aria-hidden="true" />
            <div>
              <strong>Reinforce Linear Equations</strong>
              <p style={styles.muted}>
                A large group is showing similar errors. Consider a visual
                balance-model intervention.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InsightTableRow({ topic, students, intervention }) {
  return (
    <div style={styles.tableRow}>
      <strong>{topic}</strong>
      <span>{students} students</span>
      <span>{intervention}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "32px",
    background:
      "linear-gradient(180deg, #f7fbfa 0%, #ffffff 42%, #f8fafc 100%)",
    color: "#17211f",
  },

  loading: {
    minHeight: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: "#087b6e",
    fontWeight: 700,
  },

  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 28,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    color: "#16877a",
    marginBottom: 8,
  },

  title: {
    fontSize: 34,
    lineHeight: 1.1,
    margin: 0,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  },

  sectionTitle: {
    fontSize: 24,
    margin: "3px 0 6px",
    fontWeight: 800,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64716e",
    maxWidth: 640,
    lineHeight: 1.6,
  },

  ctaBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },

  robotButton: {
    border: "none",
    background: "#087b6e",
    color: "#ffffff",
    borderRadius: 13,
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 10px 24px rgba(8,123,110,.22)",
  },

  ctaHint: {
    fontSize: 12,
    color: "#788582",
    textAlign: "right",
    maxWidth: 220,
  },

  status: {
    padding: "11px 14px",
    borderRadius: 11,
    marginBottom: 20,
    fontSize: 13,
    fontWeight: 700,
  },

  statusError: {
    background: "#fff1f1",
    color: "#b42318",
    border: "1px solid #f2caca",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e4ebe9",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },

  muted: {
    color: "#687672",
    fontSize: 14,
    lineHeight: 1.5,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },

  insightTable: {
    marginTop: 22,
    border: "1px solid #e4ebe9",
    borderRadius: 14,
    overflow: "hidden",
  },

  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr 1.8fr",
    gap: 16,
    padding: 14,
    background: "#f4f8f7",
    fontSize: 12,
    fontWeight: 800,
    color: "#66736f",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr 1.8fr",
    gap: 16,
    padding: 16,
    borderTop: "1px solid #edf1f0",
    fontSize: 14,
    alignItems: "center",
  },

  masteryCircle: {
    width: 120,
    height: 120,
    borderRadius: "50%",
    border: "10px solid #d8eee9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 850,
    color: "#087b6e",
    margin: "25px auto 18px",
  },

  recommendation: {
    display: "flex",
    gap: 14,
    background: "#f3f8f7",
    borderRadius: 14,
    padding: 16,
    marginTop: 18,
  },
};
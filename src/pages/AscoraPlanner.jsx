import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

const C = {
  bg: "#07111f",
  panel: "rgba(13, 27, 45, 0.78)",
  panelStrong: "rgba(16, 33, 54, 0.96)",
  border: "rgba(148, 163, 184, 0.14)",
  text: "#f8fafc",
  muted: "#94a3b8",
  cyan: "#38bdf8",
  violet: "#8b5cf6",
  green: "#34d399",
  amber: "#f59e0b",
};

function getDateForDay(dayIndex) {
  const today = new Date();
  const day = today.getDay();

  const mondayOffset = day === 0 ? -6 : 1 - day;

  const date = new Date(today);
  date.setDate(today.getDate() + mondayOffset + dayIndex);

  return date.toISOString().slice(0, 10);
}

function formatTime(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTypeIcon(type) {
  switch (type) {
    case "lesson":
      return "✦";
    case "resource":
      return "▤";
    case "test":
      return "✓";
    case "assignment":
      return "▣";
    default:
      return "•";
  }
}

function getTypeLabel(type) {
  switch (type) {
    case "lesson":
      return "LESSON";
    case "resource":
      return "RESOURCE";
    case "test":
      return "TEST";
    case "assignment":
      return "ASSIGNMENT";
    default:
      return "SCHEDULED";
  }
}

function getStatusColor(status) {
  if (status === "completed") return C.green;
  if (status === "active") return C.amber;
  return C.muted;
}

export default function AscoraPlanner() {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const days = useMemo(
    () => [
      { label: "MON", date: getDateForDay(0) },
      { label: "TUE", date: getDateForDay(1) },
      { label: "WED", date: getDateForDay(2) },
      { label: "THU", date: getDateForDay(3) },
      { label: "FRI", date: getDateForDay(4) },
      { label: "SAT", date: getDateForDay(5) },
      { label: "SUN", date: getDateForDay(6) },
    ],
    []
  );

  const selectedDate = days[selectedDay]?.date;

  async function loadSchedule(date) {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(
        `/api/planner/schedule?date=${encodeURIComponent(date)}`
      );

      setItems(
        (data?.items || []).sort((a, b) =>
          String(a.start_time || "").localeCompare(String(b.start_time || ""))
        )
      );
    } catch (err) {
      console.error("Planner loading error:", err);
      setItems([]);
      setError(err?.message || "Unable to load planner.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedDate) {
      loadSchedule(selectedDate);
    }
  }, [selectedDate]);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 130px)",
        color: C.text,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          marginBottom: 25,
        }}
      >
        <div>
          <div
            style={{
              color: C.cyan,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            ASCORA PLANNER
          </div>

          <h1
            style={{
              margin: "7px 0 5px",
              fontSize: 30,
              letterSpacing: "-1px",
            }}
          >
            Automated Learning Schedule
          </h1>

          <p
            style={{
              margin: 0,
              color: C.muted,
              fontSize: 12,
            }}
          >
            ASCORA organizes lessons, resources, tests and assignments
            automatically.
          </p>
        </div>

        <div
          style={{
            padding: "10px 13px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.panel,
            color: C.green,
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          ● PLANNER ACTIVE
        </div>
      </div>

      {/* WEEK RAIL */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          marginBottom: 22,
        }}
      >
        {days.map((day, index) => {
          const active = selectedDay === index;

          return (
            <button
              key={day.date}
              onClick={() => setSelectedDay(index)}
              style={{
                border: `1px solid ${
                  active ? "rgba(56,189,248,.35)" : C.border
                }`,
                background: active
                  ? "rgba(56,189,248,.10)"
                  : "rgba(13,27,45,.55)",
                color: active ? C.text : C.muted,
                borderRadius: 14,
                padding: "13px 8px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                }}
              >
                {day.label}
              </div>

              <div
                style={{
                  fontSize: 11,
                  marginTop: 5,
                }}
              >
                {day.date}
              </div>
            </button>
          );
        })}
      </div>

      {/* SCHEDULE */}
      <div
        style={{
          border: `1px solid ${C.border}`,
          background: C.panel,
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {selectedDate}
            </div>

            <div
              style={{
                marginTop: 4,
                color: C.muted,
                fontSize: 10,
              }}
            >
              {items.length} scheduled item{items.length === 1 ? "" : "s"}
            </div>
          </div>

          <button
            onClick={() => loadSchedule(selectedDate)}
            style={{
              border: `1px solid ${C.border}`,
              background: "rgba(148,163,184,.05)",
              color: C.muted,
              borderRadius: 9,
              padding: "8px 11px",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            ↻ Refresh
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {loading && (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading planner...
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                padding: 25,
                borderRadius: 14,
                background: "rgba(239,68,68,.07)",
                border: "1px solid rgba(239,68,68,.16)",
                color: "#fca5a5",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div
              style={{
                padding: 55,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 12,
                }}
              >
                ◫
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                No scheduled items
              </div>

              <div
                style={{
                  color: C.muted,
                  fontSize: 11,
                  marginTop: 7,
                }}
              >
                The automated planner has not generated a schedule for this
                day yet.
              </div>
            </div>
          )}

          {!loading &&
            !error &&
            items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "105px 1fr",
                  gap: 18,
                  padding: "16px 8px",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    color: C.muted,
                    fontSize: 10,
                    fontWeight: 700,
                    paddingTop: 4,
                  }}
                >
                  {formatTime(item.start_time)}
                  <br />
                  <span style={{ opacity: 0.6 }}>
                    {formatTime(item.end_time)}
                  </span>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 15,
                    border: `1px solid ${C.border}`,
                    background: C.panelStrong,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: 9,
                            background: "rgba(56,189,248,.10)",
                            color: C.cyan,
                          }}
                        >
                          {getTypeIcon(item.item_type)}
                        </span>

                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {item.title}
                        </span>
                      </div>

                      {item.topic && (
                        <div
                          style={{
                            marginTop: 9,
                            color: C.cyan,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {item.topic}
                        </div>
                      )}

                      {item.description && (
                        <div
                          style={{
                            marginTop: 7,
                            color: C.muted,
                            fontSize: 11,
                            lineHeight: 1.5,
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 900,
                          letterSpacing: 0.8,
                          color: C.muted,
                        }}
                      >
                        {getTypeLabel(item.item_type)}
                      </span>

                      <span
                        style={{
                          fontSize: 9,
                          color: getStatusColor(item.status),
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        ● {item.status || "scheduled"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
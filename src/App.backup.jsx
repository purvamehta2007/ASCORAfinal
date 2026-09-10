import { useMemo, useState } from "react";

// ============================================================
// ASCORA PLANNER — DESIGN TOKENS
// ============================================================

const ink = "#1C2321";
const paper = "#F6F3EC";
const paperDim = "#EFEBE1";

const sage = "#4F7869";
const sageDim = "#DCE7E1";

const amber = "#C98A3A";
const amberDim = "#F3E2C6";

const rust = "#B4552F";

const slate = "#6B7280";
const line = "#DAD4C4";

const FONT_SERIF = "'Fraunces', Georgia, serif";
const FONT_SANS = "'Inter', system-ui, sans-serif";

// ============================================================
// TEMPORARY MOCK DATA
// This will later be replaced by schedule_items from Supabase.
// ============================================================

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TODAY_INDEX = 3;

const SCHEDULES = {
  0: [],
  1: [],
  2: [],

  3: [
    {
      id: "lesson-1",
      title: "Fractions: equivalent forms",
      topic: "Fractions",
      item_type: "lesson",
      start_time: "09:00:00",
      end_time: "09:45:00",
      status: "completed",
      target: {
        label: "Mastery target",
        value: 80,
        achieved: 86,
      },
    },

    {
      id: "lesson-2",
      title: "Decimals & place value",
      topic: "Decimals",
      item_type: "lesson",
      start_time: "09:45:00",
      end_time: "10:30:00",
      status: "completed",
      target: {
        label: "Mastery target",
        value: 75,
        achieved: 71,
      },
    },

    {
      id: "practice-1",
      title: "Word problems: mixed operations",
      topic: "Word Problems",
      item_type: "practice",
      start_time: "10:45:00",
      end_time: "11:30:00",
      status: "in_progress",
      target: {
        label: "Mastery target",
        value: 70,
        achieved: 42,
      },
    },

    {
      id: "lesson-3",
      title: "Reading comprehension: inference",
      topic: "Reading",
      item_type: "lesson",
      start_time: "11:30:00",
      end_time: "12:15:00",
      status: "scheduled",
      target: {
        label: "Mastery target",
        value: 80,
        achieved: null,
      },
    },

    {
      id: "assessment-1",
      title: "States of matter: check-in quiz",
      topic: "Science",
      item_type: "assessment",
      start_time: "13:15:00",
      end_time: "14:00:00",
      status: "scheduled",
      target: {
        label: "Mastery target",
        value: 85,
        achieved: null,
      },
    },
  ],

  4: [
    {
      id: "lesson-4",
      title: "Fractions: adding unlike denominators",
      topic: "Fractions",
      item_type: "lesson",
      start_time: "09:00:00",
      end_time: "09:45:00",
      status: "scheduled",
      target: {
        label: "Mastery target",
        value: 80,
        achieved: null,
      },
    },

    {
      id: "practice-2",
      title: "Independent reading block",
      topic: "Reading",
      item_type: "practice",
      start_time: "09:45:00",
      end_time: "10:30:00",
      status: "scheduled",
      target: {
        label: "Mastery target",
        value: 75,
        achieved: null,
      },
    },
  ],

  5: [],
  6: [],
};

// ============================================================
// STATUS
// ============================================================

const STATUS_META = {
  completed: {
    label: "Completed",
    color: sage,
    bg: sageDim,
  },

  in_progress: {
    label: "In progress",
    color: amber,
    bg: amberDim,
  },

  scheduled: {
    label: "Scheduled",
    color: slate,
    bg: "#ECEAE3",
  },
};

// ============================================================
// ITEM TYPE
// ============================================================

const ITEM_TYPE_META = {
  lesson: {
    label: "Lesson",
    color: sage,
  },

  practice: {
    label: "Practice",
    color: amber,
  },

  resource: {
    label: "Resource",
    color: slate,
  },

  test: {
    label: "Test",
    color: rust,
  },

  assessment: {
    label: "Assessment",
    color: rust,
  },

  assignment: {
    label: "Assignment",
    color: amber,
  },
};

// ============================================================
// HELPERS
// ============================================================

function to12h(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);

  const hour = hours % 12 === 0 ? 12 : hours % 12;

  const suffix = hours < 12 ? "AM" : "PM";

  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function minutesOf(time) {
  if (!time) return 0;

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

// ============================================================
// TARGET RING
// ============================================================

function TargetRing({ items }) {
  const withTargets = items.filter((item) => item.target);

  const measured = withTargets.filter(
    (item) => item.target.achieved != null
  );

  const met = measured.filter(
    (item) => item.target.achieved >= item.target.value
  );

  const total = withTargets.length || 1;

  const percentage = Math.round((met.length / total) * 100);

  const radius = 30;

  const circumference = 2 * Math.PI * radius;

  const offset =
    circumference - (percentage / 100) * circumference;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
      }}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        aria-label={`${percentage}% targets met`}
      >
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={line}
          strokeWidth="6"
        />

        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={percentage === 100 ? sage : amber}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{
            transition: "stroke-dashoffset 0.5s ease",
          }}
        />

        <text
          x="36"
          y="41"
          textAnchor="middle"
          fontFamily={FONT_SANS}
          fontSize="16"
          fontWeight="600"
          fill={ink}
        >
          {percentage}%
        </text>
      </svg>

      <div
        style={{
          fontFamily: FONT_SANS,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: slate,
            letterSpacing: 0.2,
          }}
        >
          Targets met today
        </div>

        <div
          style={{
            fontSize: 13,
            color: ink,
            marginTop: 3,
          }}
        >
          {met.length} of {total} lesson blocks on pace
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TYPE BADGE
// ============================================================

function TypeBadge({ item }) {
  const meta =
    ITEM_TYPE_META[item.item_type] ||
    ITEM_TYPE_META.lesson;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10,
        fontWeight: 600,
        color: meta.color,
        background: paperDim,
        padding: "3px 8px",
        borderRadius: 20,
        letterSpacing: 0.2,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: meta.color,
        }}
      />

      {meta.label}
    </span>
  );
}

// ============================================================
// SCHEDULE BLOCK
// ============================================================

function ScheduleBlock({ item, isFirst }) {
  const status =
    STATUS_META[item.status] || STATUS_META.scheduled;

  const [open, setOpen] = useState(false);

  const achieved = item.target?.achieved;

  const target = item.target?.value;

  const targetColor =
    achieved == null
      ? slate
      : achieved >= target
        ? sage
        : rust;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        paddingTop: isFirst ? 0 : 22,
      }}
    >
      {/* TIME */}

      <div
        style={{
          width: 64,
          flexShrink: 0,
          fontFamily: FONT_SANS,
          fontSize: 12,
          color: slate,
          paddingTop: 4,
          textAlign: "right",
        }}
      >
        {to12h(item.start_time)}
      </div>

      {/* TIMELINE */}

      <div
        style={{
          position: "relative",
          width: 12,
          flexShrink: 0,
        }}
      >
        {!isFirst && (
          <div
            style={{
              position: "absolute",
              top: -22,
              left: 5,
              width: 2,
              bottom: 6,
              background: line,
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: status.color,
            boxShadow: `0 0 0 3px ${paper}`,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 10,
            left: 5,
            width: 2,
            bottom: -22,
            background: line,
          }}
        />
      </div>

      {/* SCHEDULE CARD */}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: paper,
          border: `1px solid ${line}`,
          borderLeft: `3px solid ${status.color}`,
          borderRadius: 4,
          padding: "13px 16px",
          cursor: "pointer",
          fontFamily: FONT_SANS,
          boxShadow: open
            ? "0 2px 8px rgba(28,35,33,0.06)"
            : "none",
          transition:
            "box-shadow 0.2s ease, transform 0.2s ease",
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
          <div
            style={{
              minWidth: 0,
            }}
          >
            {/* META */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: slate,
                }}
              >
                {item.topic}
              </span>

              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: line,
                }}
              />

              <span
                style={{
                  fontSize: 11,
                  color: slate,
                }}
              >
                {to12h(item.start_time)}–
                {to12h(item.end_time)}
              </span>
            </div>

            {/* TITLE */}

            <div
              style={{
                fontSize: 15,
                color: ink,
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              {item.title}
            </div>

            {/* ITEM TYPE */}

            <div
              style={{
                marginTop: 8,
              }}
            >
              <TypeBadge item={item} />
            </div>
          </div>

          {/* STATUS */}

          <span
            style={{
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 600,
              color: status.color,
              background: status.bg,
              padding: "4px 9px",
              borderRadius: 20,
              whiteSpace: "nowrap",
            }}
          >
            {status.label}
          </span>
        </div>

        {/* EXPANDED TARGET */}

        {open && item.target && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 11,
              borderTop: `1px solid ${line}`,
              fontSize: 12,
              color: slate,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              {item.target.label}:{" "}
              <strong style={{ color: ink }}>
                {item.target.value}%
              </strong>
            </span>

            <span
              style={{
                color: targetColor,
              }}
            >
              {achieved == null
                ? "Not yet measured"
                : `Class average: ${achieved}%`}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptySchedule() {
  return (
    <div
      style={{
        padding: "56px 20px",
        textAlign: "center",
        color: slate,
        fontSize: 14,
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          margin: "0 auto 14px",
          borderRadius: "50%",
          background: sageDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: sage,
          fontSize: 18,
        }}
      >
        ✦
      </div>

      <div
        style={{
          color: ink,
          fontWeight: 500,
          marginBottom: 5,
        }}
      >
        No plan generated yet
      </div>

      <div
        style={{
          fontSize: 12,
          color: slate,
        }}
      >
        Run the automated planner to schedule
        today's learning blocks.
      </div>
    </div>
  );
}

// ============================================================
// MAIN PLANNER
// ============================================================

export default function AscoraPlanner() {
  const [dayIndex, setDayIndex] = useState(TODAY_INDEX);

  const items = useMemo(() => {
    return (SCHEDULES[dayIndex] || [])
      .slice()
      .sort(
        (a, b) =>
          minutesOf(a.start_time) -
          minutesOf(b.start_time)
      );
  }, [dayIndex]);

  const dateLabels = {
    0: "Sep 7",
    1: "Sep 8",
    2: "Sep 9",
    3: "Sep 10",
    4: "Sep 11",
    5: "Sep 12",
    6: "Sep 13",
  };

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        background: paperDim,
        minHeight: "100%",
        display: "flex",
        maxWidth: 820,
        margin: "0 auto",
        border: `1px solid ${line}`,
        color: ink,
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');

        * {
          box-sizing: border-box;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        button:focus-visible {
          outline: 2px solid ${sage};
          outline-offset: 2px;
        }
      `}</style>

      {/* ======================================================
          WEEK RAIL
      ====================================================== */}

      <aside
        style={{
          width: 68,
          flexShrink: 0,
          background: ink,
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            color: paper,
            fontFamily: FONT_SERIF,
            fontSize: 16,
            marginBottom: 14,
          }}
        >
          A
        </div>

        {WEEK.map((day, index) => {
          const active = index === dayIndex;

          const hasItems =
            (SCHEDULES[index] || []).length > 0;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setDayIndex(index)}
              aria-label={`View ${day}`}
              style={{
                width: 44,
                padding: "8px 0",
                background: active
                  ? paper
                  : "transparent",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                color: active
                  ? ink
                  : "#CFCABF",
                fontFamily: FONT_SANS,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {day}
              </span>

              {hasItems && (
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: active
                      ? amber
                      : "#5A645F",
                  }}
                />
              )}
            </button>
          );
        })}
      </aside>

      {/* ======================================================
          MAIN PANEL
      ====================================================== */}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "26px 30px 36px",
          background: paper,
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            paddingBottom: 18,
            borderBottom: `1px solid ${line}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: slate,
                marginBottom: 5,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              ASCORA · Automated Plan
            </div>

            <h1
              style={{
                fontFamily: FONT_SERIF,
                fontWeight: 500,
                fontSize: 28,
                lineHeight: 1.15,
                color: ink,
                margin: 0,
              }}
            >
              {dayIndex === TODAY_INDEX
                ? "Today, "
                : ""}
              {WEEK[dayIndex]}, {dateLabels[dayIndex]}
            </h1>

            <div
              style={{
                fontSize: 12,
                color: slate,
                marginTop: 7,
              }}
            >
              Room 4B · Adaptive learning schedule
            </div>
          </div>

          <TargetRing items={items} />
        </div>

        {/* SCHEDULE */}

        <div
          style={{
            marginTop: 28,
          }}
        >
          {items.length === 0 ? (
            <EmptySchedule />
          ) : (
            items.map((item, index) => (
              <ScheduleBlock
                key={item.id || `${item.title}-${index}`}
                item={item}
                isFirst={index === 0}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
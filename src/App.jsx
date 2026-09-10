import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { supabase } from "./lib/supabase";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Classroom from "./pages/Classroom";
import Assessment from "./pages/Assessment";
import Test from "./pages/test";
import Notebook from "./pages/Notebook";
import Insights from "./pages/Insights";
import Teacher from "./pages/Teacher";
import Ascora from "./pages/Ascora";
import AscoraPlanner from "./pages/AscoraPlanner";

/* =========================================================
   ASCORA DESIGN SYSTEM
========================================================= */

const C = {
  bg: "#07111f",
  panel: "rgba(13, 27, 45, 0.78)",
  panelStrong: "rgba(16, 33, 54, 0.96)",
  border: "rgba(148, 163, 184, 0.14)",
  text: "#f8fafc",
  muted: "#94a3b8",
  cyan: "#38bdf8",
  cyanSoft: "rgba(56, 189, 248, 0.12)",
  violet: "#8b5cf6",
  green: "#34d399",
};

const globalCss = `
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; }
  body {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #07111f;
    color: #f8fafc;
  }
  button, input, textarea, select { font: inherit; }
  ::selection { background: rgba(56,189,248,.25); }
  .ascora-scroll::-webkit-scrollbar { width: 7px; }
  .ascora-scroll::-webkit-scrollbar-thumb {
    background: rgba(148,163,184,.22);
    border-radius: 99px;
  }
  @keyframes ascora-pulse {
    0%, 100% { opacity: .45; transform: scale(.96); }
    50% { opacity: 1; transform: scale(1); }
  }
  @keyframes ascora-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
`;

/* =========================================================
   PROTECTED ROUTE
========================================================= */

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/auth" replace />;
  return children;
}

/* =========================================================
   PROFILE LOADING
========================================================= */

function useStudent(session) {
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadStudent() {
      if (!session?.user?.id) {
        if (mounted) {
          setStudent(null);
          setStudentLoading(false);
        }
        return;
      }

      setStudentLoading(true);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) console.error("Student profile error:", error);
        if (!mounted) return;

        const metadata = session.user.user_metadata || {};

        setStudent({
          ...(data || {}),
          id: session.user.id,
          email: data?.email || session.user.email || "",
          name:
            data?.name ||
            data?.full_name ||
            metadata.full_name ||
            metadata.name ||
            session.user.email?.split("@")[0] ||
            "Student",
          language: data?.language || "English",
        });
      } catch (error) {
        console.error("Failed to load student:", error);

        if (mounted) {
          const metadata = session.user.user_metadata || {};
          setStudent({
            id: session.user.id,
            email: session.user.email || "",
            name:
              metadata.full_name ||
              metadata.name ||
              session.user.email?.split("@")[0] ||
              "Student",
            language: "English",
          });
        }
      } finally {
        if (mounted) setStudentLoading(false);
      }
    }

    loadStudent();

    return () => {
      mounted = false;
    };
  }, [session]);

  return { student, studentLoading };
}

/* =========================================================
   TOP BRAND
========================================================= */

function Brand({ compact = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div
        style={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(135deg, rgba(56,189,248,.22), rgba(139,92,246,.22))",
          border: "1px solid rgba(56,189,248,.22)",
          boxShadow: "0 0 28px rgba(56,189,248,.08)",
          fontSize: compact ? 17 : 19,
        }}
      >
        ✦
      </div>

      <div>
        <div
          style={{
            fontSize: compact ? 16 : 18,
            fontWeight: 850,
            letterSpacing: "-.4px",
          }}
        >
          ASCORA
        </div>
        {!compact && (
          <div style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>
            Adaptive learning intelligence
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   ROLE PILL
========================================================= */

function RolePill({ teacher = false }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 10px",
        borderRadius: 999,
        background: teacher
          ? "rgba(139,92,246,.12)"
          : "rgba(56,189,248,.10)",
        border: `1px solid ${
          teacher ? "rgba(139,92,246,.22)" : "rgba(56,189,248,.20)"
        }`,
        color: teacher ? "#c4b5fd" : "#7dd3fc",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: teacher ? C.violet : C.cyan,
          boxShadow: `0 0 10px ${teacher ? C.violet : C.cyan}`,
        }}
      />
      {teacher ? "TEACHER SPACE" : "STUDENT SPACE"}
    </div>
  );
}

/* =========================================================
   NAV ITEM
========================================================= */

function NavItem({ item }) {
  return (
    <NavLink
      to={item.path}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {({ isActive }) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 13px",
            borderRadius: 13,
            background: isActive
              ? "linear-gradient(90deg, rgba(56,189,248,.13), rgba(56,189,248,.04))"
              : "transparent",
            border: isActive
              ? "1px solid rgba(56,189,248,.15)"
              : "1px solid transparent",
            color: isActive ? C.text : "#9aabc0",
            fontWeight: isActive ? 700 : 500,
            transition: "all .18s ease",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              borderRadius: 8,
              background: isActive
                ? "rgba(56,189,248,.12)"
                : "rgba(148,163,184,.05)",
              fontSize: 14,
            }}
          >
            {item.icon}
          </span>

          <span style={{ flex: 1 }}>{item.label}</span>

          {item.badge && (
            <span
              style={{
                fontSize: 9,
                padding: "3px 6px",
                borderRadius: 999,
                background: "rgba(52,211,153,.10)",
                color: "#6ee7b7",
                fontWeight: 800,
              }}
            >
              {item.badge}
            </span>
          )}
        </div>
      )}
    </NavLink>
  );
}

/* =========================================================
   PORTAL LAYOUT
========================================================= */

function PortalLayout({ student, children, teacher = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  const studentNavigation = [
    { path: "/dashboard", label: "Overview", icon: "⌂" },
    { path: "/classroom", label: "AI Classroom", icon: "✦" },
    { path: "/assessment", label: "Assessments", icon: "✓" },
    { path: "/Test", label: "Tests", icon: "▣" },
    { path: "/notebook", label: "My Notes", icon: "▤" },
    { path: "/insights", label: "My Progress", icon: "◈" },
  ];

  const teacherNavigation = [
    { path: "/teacher", label: "Overview", icon: "⌂" },
    { path: "/teacher/insights", label: "Student Insights", icon: "◈" },
  ];

  const navigation = teacher ? teacherNavigation : studentNavigation;

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoggingOut(false);
    }
  }

  const name =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  return (
    <>
      <style>{globalCss}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          background:
            "radial-gradient(circle at 15% 0%, rgba(56,189,248,.08), transparent 28%), radial-gradient(circle at 90% 10%, rgba(139,92,246,.08), transparent 24%), #07111f",
        }}
      >
        {/* SIDEBAR */}
        <aside
          style={{
            width: 258,
            flexShrink: 0,
            minHeight: "100vh",
            position: "sticky",
            top: 0,
            height: "100vh",
            padding: 18,
            borderRight: `1px solid ${C.border}`,
            background: "rgba(5, 15, 28, .84)",
            backdropFilter: "blur(22px)",
            display: "flex",
            flexDirection: "column",
            zIndex: 10,
          }}
        >
          <div style={{ padding: "8px 9px 25px" }}>
            <Brand />
          </div>

          <div style={{ padding: "0 5px 17px" }}>
            <RolePill teacher={teacher} />
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              padding: "0 13px 9px",
            }}
          >
            {teacher ? "Teaching workspace" : "Learning space"}
          </div>

          <nav
            className="ascora-scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              overflowY: "auto",
            }}
          >
            {navigation.map((item, index) => (
              <NavItem
                key={`${item.path}-${item.label}-${index}`}
                item={item}
              />
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          {/* TEACHER SPACE */}
          {!teacher && (
            <div
              style={{
                margin: "0 0 10px",
                padding: 14,
                borderRadius: 16,
                background:
                  "linear-gradient(135deg, rgba(139,92,246,.10), rgba(56,189,248,.06))",
                border: "1px solid rgba(139,92,246,.14)",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 7 }}>🎓</div>
              <div style={{ fontSize: 12, fontWeight: 750 }}>
                Teacher Space
              </div>
              <div
                style={{
                  color: C.muted,
                  fontSize: 10,
                  lineHeight: 1.45,
                  margin: "4px 0 10px",
                }}
              >
                Create lessons, assessments and view student insights.
              </div>

              <button
                onClick={() => navigate("/teacher")}
                style={{
                  width: "100%",
                  border: "1px solid rgba(139,92,246,.20)",
                  borderRadius: 10,
                  padding: "9px 10px",
                  cursor: "pointer",
                  color: "#ddd6fe",
                  background: "rgba(139,92,246,.12)",
                  fontWeight: 750,
                  fontSize: 11,
                }}
              >
                Open Teacher Dashboard →
              </button>
            </div>
          )}

          {/* ROBOT CTA */}
          {!teacher && (
            <div
              style={{
                margin: "0 0 13px",
                padding: 14,
                borderRadius: 16,
                background:
                  "linear-gradient(135deg, rgba(56,189,248,.10), rgba(139,92,246,.09))",
                border: "1px solid rgba(56,189,248,.12)",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 7 }}>🤖</div>
              <div style={{ fontSize: 12, fontWeight: 750 }}>
                ASCORA Robot
              </div>
              <div
                style={{
                  color: C.muted,
                  fontSize: 10,
                  lineHeight: 1.45,
                  margin: "4px 0 10px",
                }}
              >
                Join the live adaptive classroom.
              </div>

              <button
                onClick={() => navigate("/ascora")}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 10,
                  padding: "9px 10px",
                  cursor: "pointer",
                  color: "#dff6ff",
                  background: "rgba(56,189,248,.13)",
                  border: "1px solid rgba(56,189,248,.18)",
                  fontWeight: 750,
                  fontSize: 11,
                }}
              >
                Open Robot →
              </button>
            </div>
          )}

          {/* ACCOUNT */}
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 8px 11px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 11,
                  display: "grid",
                  placeItems: "center",
                  background: teacher
                    ? "rgba(139,92,246,.14)"
                    : "rgba(56,189,248,.12)",
                  border: `1px solid ${
                    teacher
                      ? "rgba(139,92,246,.18)"
                      : "rgba(56,189,248,.18)"
                  }`,
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {name.slice(0, 1).toUpperCase()}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: .8,
                  }}
                >
                  Signed in
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                width: "100%",
                border: `1px solid ${C.border}`,
                borderRadius: 11,
                padding: "9px 10px",
                color: "#94a3b8",
                background: "rgba(148,163,184,.04)",
                cursor: loggingOut ? "default" : "pointer",
                fontSize: 11,
                fontWeight: 650,
              }}
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </aside>

        {/* CONTENT */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: "100vh",
          }}
        >
          {/* TOP BAR */}
          <header
            style={{
              height: 68,
              padding: "0 30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(7,17,31,.52)",
              backdropFilter: "blur(18px)",
              position: "sticky",
              top: 0,
              zIndex: 5,
            }}
          >
            <div>
              <div
                style={{
                  color: "#64748b",
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {teacher ? "Teaching workspace" : "Learning workspace"}
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 3,
                }}
              >
                {teacher
                  ? "Design. Teach. Understand."
                  : "Learn at your own pace."}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => navigate("/planner")}
                style={{
                  border: "1px solid rgba(139,92,246,.20)",
                  background: "rgba(139,92,246,.09)",
                  color: "#c4b5fd",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 750,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ◫ Planner
              </button>

              {!teacher && (
                <button
                  onClick={() => navigate("/ascora")}
                  style={{
                    border: "1px solid rgba(56,189,248,.18)",
                    background: "rgba(56,189,248,.08)",
                    color: "#7dd3fc",
                    borderRadius: 10,
                    padding: "8px 11px",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 750,
                  }}
                >
                  🤖 ASCORA LIVE
                </button>
              )}

              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: C.green,
                  boxShadow: `0 0 12px ${C.green}`,
                  animation: "ascora-pulse 2s infinite",
                }}
              />
              <span style={{ color: C.muted, fontSize: 10 }}>
                System online
              </span>
            </div>
          </header>

          <div
            style={{
              padding: "30px",
              maxWidth: 1500,
              margin: "0 auto",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

/* =========================================================
   ROBOT FULLSCREEN SHELL
========================================================= */

function RobotShell({ student, children }) {
  const navigate = useNavigate();

  const name =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  return (
    <>
      <style>{globalCss}</style>

      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          background:
            "radial-gradient(circle at 50% -10%, rgba(56,189,248,.13), transparent 32%), radial-gradient(circle at 0% 100%, rgba(139,92,246,.10), transparent 30%), #030b15",
          color: C.text,
          overflow: "hidden",
        }}
      >
        {/* ROBOT HEADER */}
        <header
          style={{
            height: 62,
            padding: "0 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(148,163,184,.10)",
            background: "rgba(3,11,21,.68)",
            backdropFilter: "blur(20px)",
          }}
        >
          <Brand compact />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "#6ee7b7",
                fontSize: 10,
                fontWeight: 750,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: C.green,
                  boxShadow: `0 0 12px ${C.green}`,
                  animation: "ascora-pulse 1.8s infinite",
                }}
              />
              ROBOT ONLINE
            </div>

            <div
              style={{
                width: 1,
                height: 18,
                background: "rgba(148,163,184,.14)",
              }}
            />

            <div style={{ color: "#64748b", fontSize: 10 }}>
              {name}
            </div>

            <button
              onClick={() => navigate("/dashboard")}
              style={{
                border: "1px solid rgba(148,163,184,.14)",
                background: "rgba(148,163,184,.05)",
                color: "#94a3b8",
                borderRadius: 9,
                padding: "7px 10px",
                cursor: "pointer",
                fontSize: 10,
              }}
            >
              Exit
            </button>
          </div>
        </header>

        {/* ROBOT CONTENT */}
        <div style={{ minHeight: "calc(100vh - 62px)" }}>{children}</div>
      </div>
    </>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const { student, studentLoading } = useStudent(session);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) console.error("Supabase session error:", error);
        if (mounted) setSession(data?.session ?? null);
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <>
        <style>{globalCss}</style>
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: C.bg,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: -1,
                animation: "ascora-float 2s infinite",
              }}
            >
              ASCORA
            </div>
            <div
              style={{
                color: C.muted,
                fontSize: 11,
                marginTop: 8,
              }}
            >
              Initializing adaptive learning environment...
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ascora-demo" element={<Ascora />} />

        {/* existing protected ASCORA route is defined below */}
        <Route
          path="/auth"
          element={
            session ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Auth />
            )
          }
        />

        {/* ================= STUDENT ================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                {studentLoading ? (
                  <LoadingPanel text="Preparing your learning space..." />
                ) : (
                  <Dashboard student={student} />
                )}
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/classroom"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                <Classroom student={student} />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/assessment"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                <Assessment student={student} />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/Test"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                <Test student={student} />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/notebook"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                <Notebook student={student} />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/insights"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                <Insights student={student} />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        {/* ================= TEACHER ================= */}

        <Route
          path="/teacher"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student} teacher>
                <Teacher student={student} />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        {/* ================= GLOBAL PLANNER ================= */}

        <Route
          path="/planner"
          element={
            <ProtectedRoute session={session}>
              <PortalLayout student={student}>
                <AscoraPlanner />
              </PortalLayout>
            </ProtectedRoute>
          }
        />

        {/* Backward-compatible teacher planner URL */}
        <Route
          path="/teacher/planner"
          element={
            <Navigate to="/planner" replace />
          }
        />

        {/* ================= ROBOT ================= */}

        <Route
          path="/ascora"
          element={
            <ProtectedRoute session={session}>
              <RobotShell student={student}>
                <Ascora student={student} />
              </RobotShell>
            </ProtectedRoute>
          }
        />

        {/* ROOT */}
        <Route
          path="/"
          element={
            <Navigate
              to={session ? "/dashboard" : "/auth"}
              replace
            />
          }
        />

        {/* UNKNOWN */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingPanel({ text }) {
  return (
    <div
      style={{
        minHeight: "55vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: 30,
          borderRadius: 20,
          border: `1px solid ${C.border}`,
          background: "rgba(13,27,45,.55)",
          minWidth: 280,
        }}
      >
        <div style={{ fontSize: 26, animation: "ascora-float 2s infinite" }}>
          ✦
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.muted,
            marginTop: 10,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export default App;
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


/* =========================================================
   PROTECTED ROUTE
========================================================= */

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}


/* =========================================================
   APPLICATION LAYOUT
========================================================= */

function AppLayout({ student, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);

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

  const navigation = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: "⌂",
    },
    {
      path: "/classroom",
      label: "AI Classroom",
      icon: "✦",
    },
    {
      path: "/assessment",
      label: "Assessment",
      icon: "✓",
    },
    {
      path: "/Test",
      label: "Test",
      icon: "▣",
    },
    {
      path: "/notebook",
      label: "Notebook",
      icon: "▤",
    },
    {
      path: "/insights",
      label: "Insights",
      icon: "◈",
    },
    {
      path: "/teacher",
      label: "Teacher",
      icon: "♧",
    },
    {
      path: "/ascora",
      label: "ASCORA",
      icon: "✧",
    },
  ];

  const studentName =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
      }}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        style={{
          width: 250,
          minHeight: "100vh",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        {/* BRAND */}

        <div
          style={{
            padding: "4px 12px 28px",
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            ASCORA
          </div>

          <div
            className="muted"
            style={{
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Adaptive Learning
          </div>
        </div>


        {/* NAVIGATION */}

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {navigation.map((item) => {
            const active =
              location.pathname.toLowerCase() ===
              item.path.toLowerCase();

            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 12px",
                    borderRadius: 10,
                    background: active
                      ? "rgba(255,255,255,0.10)"
                      : "transparent",
                    fontWeight: active ? 600 : 400,
                    opacity: active ? 1 : 0.72,
                    transition: "0.2s",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      textAlign: "center",
                      fontSize: 17,
                    }}
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </div>
              </NavLink>
            );
          })}
        </nav>


        {/* SPACER */}

        <div style={{ flex: 1 }} />


        {/* STUDENT */}

        <div
          style={{
            borderTop:
              "1px solid rgba(255,255,255,0.08)",
            paddingTop: 16,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              marginBottom: 8,
            }}
          >
            <div
              className="muted"
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              Signed in as
            </div>

            <div
              style={{
                marginTop: 5,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {studentName}
            </div>
          </div>

          <button
            className="btn secondary"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              width: "100%",
            }}
          >
            {loggingOut
              ? "Signing out..."
              : "Sign out"}
          </button>
        </div>
      </aside>


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}


/* =========================================================
   APP
========================================================= */

function App() {
  const [session, setSession] = useState(null);
  const [student, setStudent] = useState(null);

  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] =
    useState(false);


  /* =======================================================
     LOAD AUTH SESSION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            "Supabase session error:",
            error
          );
        }

        if (!mounted) return;

        setSession(
          data?.session ?? null
        );
      } catch (error) {
        console.error(
          "Failed to load session:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSession();


    /* =====================================================
       AUTH STATE LISTENER
    ===================================================== */

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          setSession(newSession);

          if (!newSession) {
            setStudent(null);
          }
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  /* =======================================================
     LOAD STUDENT PROFILE
  ======================================================= */

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
        const {
          data,
          error,
        } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error(
            "Student profile error:",
            error
          );
        }

        if (!mounted) return;


        /* =================================================
           PROFILE EXISTS
        ================================================= */

        if (data) {
          setStudent({
            ...data,

            id: session.user.id,

            email:
              data.email ||
              session.user.email ||
              "",

            name:
              data.name ||
              data.full_name ||
              session.user.user_metadata
                ?.full_name ||
              session.user.user_metadata
                ?.name ||
              session.user.email
                ?.split("@")[0] ||
              "Student",

            language:
              data.language ||
              "English",
          });

          return;
        }


        /* =================================================
           NO PROFILE — USE AUTH USER
        ================================================= */

        setStudent({
          id: session.user.id,

          email:
            session.user.email || "",

          name:
            session.user.user_metadata
              ?.full_name ||
            session.user.user_metadata
              ?.name ||
            session.user.email
              ?.split("@")[0] ||
            "Student",

          language: "English",
        });
      } catch (error) {
        console.error(
          "Failed to load student:",
          error
        );

        if (!mounted) return;


        /* =================================================
           FINAL FALLBACK
        ================================================= */

        setStudent({
          id: session.user.id,

          email:
            session.user.email || "",

          name:
            session.user.user_metadata
              ?.full_name ||
            session.user.user_metadata
              ?.name ||
            session.user.email
              ?.split("@")[0] ||
            "Student",

          language: "English",
        });
      } finally {
        if (mounted) {
          setStudentLoading(false);
        }
      }
    }

    loadStudent();

    return () => {
      mounted = false;
    };
  }, [session]);


  /* =======================================================
     INITIAL LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            ASCORA
          </div>

          <p
            className="muted"
            style={{
              marginTop: 8,
            }}
          >
            Loading your learning environment...
          </p>
        </div>
      </div>
    );
  }


  /* =======================================================
     ROUTER
  ======================================================= */

  return (
    <BrowserRouter>
      <Routes>

        {/* ================================================
            AUTH
        ================================================= */}

        <Route
          path="/auth"
          element={
            session ? (
              <Navigate
                to="/dashboard"
                replace
              />
            ) : (
              <Auth />
            )
          }
        />


        {/* ================================================
            DASHBOARD
        ================================================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                {studentLoading ? (
                  <div
                    style={{
                      minHeight: "60vh",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                        }}
                      >
                        ASCORA
                      </div>

                      <p
                        className="muted"
                        style={{
                          marginTop: 8,
                        }}
                      >
                        Preparing your dashboard...
                      </p>
                    </div>
                  </div>
                ) : (
                  <Dashboard
                    student={student}
                  />
                )}
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            CLASSROOM
        ================================================= */}

        <Route
          path="/classroom"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Classroom
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            ASSESSMENT
        ================================================= */}

        <Route
          path="/assessment"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Assessment
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            TEST
        ================================================= */}

        <Route
          path="/Test"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Test
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            NOTEBOOK
        ================================================= */}

        <Route
          path="/notebook"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Notebook
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            INSIGHTS
        ================================================= */}

        <Route
          path="/insights"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Insights
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            TEACHER
        ================================================= */}

        <Route
          path="/teacher"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Teacher
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            ASCORA HARDWARE
        ================================================= */}

        <Route
          path="/ascora"
          element={
            <ProtectedRoute
              session={session}
            >
              <AppLayout student={student}>
                <Ascora
                  student={student}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />


        {/* ================================================
            ROOT
        ================================================= */}

        <Route
          path="/"
          element={
            session ? (
              <Navigate
                to="/dashboard"
                replace
              />
            ) : (
              <Navigate
                to="/auth"
                replace
              />
            )
          }
        />


        {/* ================================================
            UNKNOWN ROUTE
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;

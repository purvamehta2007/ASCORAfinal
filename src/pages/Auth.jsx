import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Radar,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";

/* =========================================================
   PAGE-SCOPED STYLES
========================================================= */

const authCss = `
  .auth-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr;
    background:
      radial-gradient(circle at 10% 0%, rgba(56,189,248,.10), transparent 32%),
      radial-gradient(circle at 100% 100%, rgba(139,92,246,.10), transparent 30%),
      #070b14;
  }
  @media (min-width: 980px) {
    .auth-shell { grid-template-columns: 1.05fr 1fr; }
  }
  .auth-visual { display: none; }
  @media (min-width: 980px) {
    .auth-visual { display: flex; }
  }
  .auth-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .auth-input-wrap input {
    padding-left: 42px;
  }
  .auth-input-icon {
    position: absolute;
    left: 14px;
    display: flex;
    color: #64748b;
    pointer-events: none;
  }
  .auth-eye-btn {
    position: absolute;
    right: 10px;
    background: transparent;
    border: 0;
    padding: 6px;
    display: flex;
    color: #64748b;
    border-radius: 8px;
  }
  .auth-eye-btn:hover { color: #cbd5e1; background: rgba(148,163,184,.08); }
  .auth-tab {
    border: 0;
    background: transparent;
    padding: 10px 0;
    border-radius: 10px;
    font-weight: 700;
    font-size: 14px;
    color: #64748b;
    transition: color .18s ease;
    position: relative;
  }
  .auth-tab.active { color: #f4f7fb; }
  .auth-submit {
    width: 100%;
    border: 0;
    border-radius: 12px;
    padding: 13px 16px;
    font-weight: 750;
    font-size: 14.5px;
    color: #04101d;
    background: linear-gradient(135deg, #38bdf8, #6366f1);
    box-shadow: 0 10px 30px rgba(56,189,248,.20);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
  }
  .auth-submit:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(56,189,248,.28); }
  .auth-submit:disabled { opacity: .55; transform: none; cursor: not-allowed; }
  .auth-google {
    width: 100%;
    border-radius: 12px;
    padding: 12.5px 16px;
    font-weight: 650;
    font-size: 14px;
    background: rgba(148,163,184,.06);
    border: 1px solid rgba(148,163,184,.16);
    color: #e5eaf3;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background .15s ease, border-color .15s ease;
  }
  .auth-google:hover { background: rgba(148,163,184,.12); border-color: rgba(148,163,184,.26); }
  @keyframes auth-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes auth-orbit {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

/* =========================================================
   VISUAL PANEL (right side)
========================================================= */

function AuthVisual() {
  const [photoFailed, setPhotoFailed] = useState(false);

  const highlights = [
    {
      icon: <Sparkles size={16} />,
      title: "Adapts in real time",
      body: "Every answer reshapes what ASCORA teaches next.",
    },
    {
      icon: <Radar size={16} />,
      title: "Spots misconceptions",
      body: "Not just wrong answers — the pattern behind them.",
    },
    {
      icon: <ShieldCheck size={16} />,
      title: "Built for classrooms",
      body: "Teacher insights, student pacing, one platform.",
    },
  ];

  return (
    <div
      className="auth-visual"
      style={{
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 52px",
        background:
          "linear-gradient(160deg, #0b1324 0%, #0e1830 46%, #171034 100%)",
        borderLeft: `1px solid ${C.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          top: -140,
          right: -120,
          background:
            "radial-gradient(circle, rgba(56,189,248,.16), transparent 68%)",
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: "50%",
          bottom: -120,
          left: -100,
          background:
            "radial-gradient(circle, rgba(139,92,246,.14), transparent 68%)",
          filter: "blur(10px)",
        }}
      />

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, rgba(56,189,248,.24), rgba(139,92,246,.24))",
              border: "1px solid rgba(56,189,248,.24)",
            }}
          >
            ✦
          </div>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
            ASCORA
          </strong>
        </div>
      </div>

      {/* PHOTO SLOT — drop your real photo at /public/hero-classroom.jpg */}
      {!photoFailed && (
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
            marginBottom: 4,
          }}
        >
          <img
            src="/hero-classroom.jpg"
            alt="ASCORA robot with students in a classroom"
            onError={() => setPhotoFailed(true)}
            style={{
              width: "100%",
              height: 200,
              objectFit: "cover",
              display: "block",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 55%, rgba(11,19,36,.85))",
            }}
          />
        </div>
      )}

      {/* fallback illustration until the real photo is added */}
      {photoFailed && (
      <div
        style={{
          position: "relative",
          margin: "20px 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <svg
          width="220"
          height="220"
          viewBox="0 0 220 220"
          style={{ animation: "auth-float 5s ease-in-out infinite" }}
        >
          <circle cx="110" cy="110" r="96" fill="url(#authRing)" opacity="0.5" />
          <defs>
            <radialGradient id="authRing">
              <stop offset="60%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(56,189,248,0.10)" />
            </radialGradient>
            <linearGradient id="authScreen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>

          <rect x="60" y="176" width="26" height="12" rx="6" fill="#1e293b" />
          <rect x="134" y="176" width="26" height="12" rx="6" fill="#1e293b" />

          <rect x="66" y="120" width="88" height="60" rx="18" fill="#0f172a" stroke="rgba(148,163,184,.28)" />
          <circle cx="110" cy="150" r="10" fill="rgba(245,165,36,.5)" />

          <rect x="100" y="86" width="20" height="38" rx="8" fill="#111827" />

          <rect x="55" y="30" width="110" height="66" rx="20" fill="#0b1220" stroke="rgba(56,189,248,.35)" strokeWidth="1.5" />
          <rect x="68" y="43" width="84" height="40" rx="12" fill="url(#authScreen)" opacity="0.85" />
          <circle cx="96" cy="63" r="6" fill="#0b1220" />
          <circle cx="124" cy="63" r="6" fill="#0b1220" />
        </svg>
      </div>
      )}

      <div style={{ position: "relative" }}>
        <h2
          style={{
            fontSize: 26,
            lineHeight: 1.25,
            maxWidth: 360,
            margin: "0 0 10px",
          }}
        >
          One robot, one classroom, every student taught differently.
        </h2>
        <p style={{ color: C.muted, fontSize: 14, maxWidth: 360, marginBottom: 26 }}>
          Sign in to pick up exactly where your last lesson left off.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {highlights.map((h) => (
            <div
              key={h.title}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(255,255,255,.03)",
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 9,
                  display: "grid",
                  placeItems: "center",
                  background: C.cyanSoft,
                  color: "#7dd3fc",
                }}
              >
                {h.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{h.title}</div>
                <div style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>
                  {h.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   AUTH PAGE
========================================================= */

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isLogin = mode === "login";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (!isLogin && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) throw loginError;
        if (!data?.user) {
          throw new Error("Login failed. Please try again.");
        }

        navigate("/dashboard");
        return;
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
        },
      });

      if (signupError) throw signupError;
      if (!data?.user) {
        throw new Error("Unable to create your account.");
      }

      if (!data.session) {
        setMessage(
          "Account created! Please check your email to verify your account, then log in."
        );
        setMode("login");
        setPassword("");
        return;
      }

      navigate("/onboarding");
    } catch (err) {
      console.error("AUTH ERROR:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (oauthError) throw oauthError;
    } catch (err) {
      console.error("GOOGLE AUTH ERROR:", err);
      setError(err?.message || "Google login failed.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <style>{authCss}</style>

      {/* ================= FORM SIDE ================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 34 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                background:
                  "linear-gradient(135deg, rgba(56,189,248,.20), rgba(139,92,246,.20))",
                border: `1px solid ${C.border}`,
                marginBottom: 18,
                fontSize: 20,
              }}
            >
              ✦
            </div>

            <h1 style={{ fontSize: 28, marginBottom: 6 }}>
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p style={{ color: C.muted, fontSize: 14.5 }}>
              {isLogin
                ? "Sign in to continue your ASCORA learning path."
                : "Set up your adaptive AI learning companion."}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "rgba(148,163,184,.06)",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 4,
              marginBottom: 24,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 4,
                bottom: 4,
                left: isLogin ? 4 : "50%",
                width: "calc(50% - 4px)",
                background: "#f4f7fb",
                borderRadius: 9,
                transition: "left .22s ease",
              }}
            />
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`auth-tab ${isLogin ? "active" : ""}`}
              style={{ zIndex: 1, color: isLogin ? "#04101d" : "#64748b" }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`auth-tab ${!isLogin ? "active" : ""}`}
              style={{ zIndex: 1, color: !isLogin ? "#04101d" : "#64748b" }}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 18,
                borderRadius: 12,
                border: `1px solid ${C.red}33`,
                background: C.redSoft,
                padding: "11px 13px",
                fontSize: 13,
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                marginBottom: 18,
                borderRadius: 12,
                border: `1px solid ${C.green}33`,
                background: C.greenSoft,
                padding: "11px 13px",
                fontSize: 13,
                color: "#6ee7b7",
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            {!isLogin && (
              <div>
                <label style={{ display: "block", fontSize: 13, color: C.mutedStrong, marginBottom: 7 }}>
                  Full name
                </label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><User size={16} /></span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 13, color: C.mutedStrong, marginBottom: 7 }}>
                Email
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Mail size={16} /></span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={{ display: "block", fontSize: 13, color: C.mutedStrong, marginBottom: 7 }}>
                  Password
                </label>
                {isLogin && (
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Min. 6 characters
                  </span>
                )}
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={16} /></span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? (
                "Please wait..."
              ) : (
                <>
                  {isLogin ? "Login" : "Create account"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
            <div style={{ height: 1, flex: 1, background: C.border }} />
            <span style={{ fontSize: 11, color: "#475569", letterSpacing: ".04em" }}>OR</span>
            <div style={{ height: 1, flex: 1, background: C.border }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="auth-google"
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.7 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3c-7.5 0-14 4.2-17.7 10.4z" />
              <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.4 26.7 37 24 37c-5.3 0-9.7-3.3-11.3-8l-6.6 5C9.9 40.6 16.4 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.3 5.8l6.2 5.2C40.8 36 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z" />
            </svg>
            Continue with Google
          </button>

          <p style={{ textAlign: "center", fontSize: 12.5, color: "#475569", marginTop: 24 }}>
            By continuing you agree to ASCORA's classroom-use terms.
          </p>
        </div>
      </div>

      {/* ================= VISUAL SIDE ================= */}
      <AuthVisual />
    </div>
  );
}
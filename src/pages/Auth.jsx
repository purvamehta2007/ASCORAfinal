import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isLogin = mode === "login";

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
      // ==========================================
      // LOGIN
      // ==========================================

      if (isLogin) {
        const {
          data,
          error: loginError,
        } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) {
          throw loginError;
        }

        if (!data?.user) {
          throw new Error("Login failed. Please try again.");
        }

        navigate("/dashboard");
        return;
      }

      // ==========================================
      // SIGNUP
      // ==========================================

      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      if (!data?.user) {
        throw new Error("Unable to create your account.");
      }

      /*
       * Depending on your Supabase email-confirmation
       * setting, session may be null after signup.
       */

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

      setError(
        err?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const {
        error: oauthError,
      } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            `${window.location.origin}/dashboard`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      console.error("GOOGLE AUTH ERROR:", err);

      setError(
        err?.message ||
          "Google login failed."
      );

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">

        {/* LOGO */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
            <span className="text-2xl font-bold">
              A
            </span>
          </div>

          <h1 className="text-3xl font-bold">
            Welcome to ASCORA
          </h1>

          <p className="text-white/50 mt-2">
            Your adaptive AI learning companion
          </p>
        </div>

        {/* CARD */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">

          {/* TABS */}
          <div className="grid grid-cols-2 bg-white/5 rounded-xl p-1 mb-7">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
              className={`py-2.5 rounded-lg transition ${
                isLogin
                  ? "bg-white text-black"
                  : "text-white/50"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
              className={`py-2.5 rounded-lg transition ${
                !isLogin
                  ? "bg-white text-black"
                  : "text-white/50"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* MESSAGE */}
          {message && (
            <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
              {message}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

            {!isLogin && (
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Full name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="Enter your name"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="student@example.com"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="••••••••"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white text-black font-semibold py-3.5 mt-3 disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login"
                : "Create account"}
            </button>
          </form>

          {/* DIVIDER */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/30">
              OR
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* GOOGLE */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 hover:bg-white/10 transition disabled:opacity-50"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
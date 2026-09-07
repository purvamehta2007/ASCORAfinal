import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAuthClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    : null;

export async function requireAuth(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Authorization header missing",
      });
    }

    const token =
      authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim();

    if (!token) {
      return res.status(401).json({
        error: "Access token missing",
      });
    }

    if (!supabaseAuthClient) {
      console.error(
        "ASCORA AUTH: Supabase authentication is not configured."
      );

      return res.status(500).json({
        error:
          "Supabase authentication is not configured",
      });
    }

    const {
      data: { user },
      error,
    } =
      await supabaseAuthClient.auth.getUser(
        token
      );

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "ASCORA AUTH ERROR:",
      error?.message || error
    );

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
}
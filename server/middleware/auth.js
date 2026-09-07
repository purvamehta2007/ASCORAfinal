import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAuthClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(
        supabaseUrl,
        supabaseAnonKey
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
        ? authHeader.substring(7)
        : authHeader;

    if (!token) {
      return res.status(401).json({
        error: "Access token missing",
      });
    }

    if (!supabaseAuthClient) {
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
      "AUTH MIDDLEWARE ERROR:",
      error
    );

    res.status(401).json({
      error: "Authentication failed",
    });
  }
}
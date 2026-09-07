import { supabase } from "./supabase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

export async function apiFetch(
  endpoint,
  options = {}
) {
  const {
    data: {
      session,
    },
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const token =
    session?.access_token;

  const headers = {
    "Content-Type":
      "application/json",

    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}
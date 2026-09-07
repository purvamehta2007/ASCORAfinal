import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error(
    "❌ SUPABASE_URL is missing"
  );
}

if (!serviceRoleKey) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY is missing"
  );
}

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    : null;
import { createClient } from "@supabase/supabase-js";

// Existing external "skillgap" project. Publishable key is safe in browser code;
// all user data is protected by the database's row-level security.
export const SUPABASE_URL = "https://ugccoeqjnupigbcpkswv.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Cd5Erpao49dGIegp9RxWlA_iQI4X5MZ";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: isBrowser, autoRefreshToken: isBrowser, detectSessionInUrl: isBrowser },
});

export function errMsg(e: unknown): string {
  if (!e) return "Something went wrong.";
  const anyE = e as { message?: string; code?: string };
  if (anyE.code === "42501") return "You don't have permission for this action (database access rule). Please sign in again.";
  if (anyE.code === "23514") return `The database rejected a value: ${anyE.message}`;
  if (anyE.message?.includes("JWT expired")) return "Your session expired. Please sign in again.";
  return anyE.message ?? "Something went wrong.";
}

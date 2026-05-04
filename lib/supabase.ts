import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client — uses anon key, respects RLS
export function browserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server client — service role key, BYPASSES RLS.
// NEVER import this from a client component. Only API routes and server components.
export function serverClient(): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export type Candidate = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
};

export type LeaderboardRow = Candidate & {
  points: number;
  baht_raised: number;
};

export async function isVotingOpen(): Promise<boolean> {
  const sb = serverClient();
  const { data } = await sb
    .from("app_settings")
    .select("value")
    .eq("key", "voting_open")
    .single();
  return data?.value === "true";
}
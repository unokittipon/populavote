import Link from "next/link";
import { serverClient, type LeaderboardRow } from "@/lib/supabase";
import Leaderboard from "@/components/Leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResultsPage() {
  const sb = serverClient();
  const { data } = await sb.from("leaderboard").select("*");
  const initial = (data ?? []) as LeaderboardRow[];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink">
        ← Back
      </Link>

      <header className="rise mt-4 border-b border-ink/20 pb-6 mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Live</p>
        <h1 className="font-display text-6xl md:text-8xl font-extrabold leading-[0.9] mt-2">
          Results
        </h1>
      </header>

      <Leaderboard initial={initial} />
    </main>
  );
}

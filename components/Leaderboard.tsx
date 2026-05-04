"use client";

import { useEffect, useState } from "react";
import { browserClient, type LeaderboardRow } from "@/lib/supabase";

export default function Leaderboard({ initial }: { initial: LeaderboardRow[] }) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initial);

  useEffect(() => {
    const sb = browserClient();

    // Re-fetch every 5s + subscribe to votes changes
    async function refresh() {
      const { data } = await sb.from("leaderboard").select("*");
      if (data) setRows(data as LeaderboardRow[]);
    }

    const channel = sb
      .channel("votes-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, refresh)
      .subscribe();

    const interval = setInterval(refresh, 5000);

    return () => {
      sb.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const sorted = [...rows].sort((a, b) => b.points - a.points);
  const max = Math.max(1, ...sorted.map((r) => r.points));
  const total = sorted.reduce((s, r) => s + r.points, 0);

  return (
    <div>
      <ol className="space-y-6">
        {sorted.map((r, i) => {
          const pct = (r.points / max) * 100;
          return (
            <li
              key={r.id}
              className="rise"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-2xl md:text-4xl font-bold">
                    {r.name}
                  </span>
                </div>
                <span className="font-display text-3xl md:text-5xl font-extrabold tabular-nums">
                  {r.points}
                  <span className="font-mono text-xs text-muted ml-2">pts</span>
                </span>
              </div>
              <div className="h-2 bg-ink/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    i === 0 ? "bg-accent" : "bg-ink"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {sorted.length === 0 && (
        <p className="font-display italic text-2xl text-muted">No votes yet.</p>
      )}
    </div>
  );
}

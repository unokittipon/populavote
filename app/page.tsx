import Link from "next/link";
import { serverClient, isVotingOpen, type LeaderboardRow } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  noStore();
  const sb = serverClient();
  const open = await isVotingOpen();
  const { data: rows } = await sb
    .from("leaderboard")
    .select("*")
    .order("display_order", { ascending: true });

  const candidates = (rows ?? []) as LeaderboardRow[];
  const totalPoints = candidates.reduce((s, c) => s + c.points, 0);

  return (
     <main className="max-w-6xl mx-auto px-6 py-10">
      {!open && (
        <div className="border-2 border-accent bg-accent/5 p-6 mb-8 rise">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Notice</p>
          <p className="font-display text-3xl font-bold mt-1 italic">Voting is closed</p>
          <p className="text-muted mt-1">Thank you to everyone who participated.</p>
        </div>
      )}

      {/* Header */}
      <header className="rise flex items-end justify-between border-b border-ink/20 pb-6 mb-12">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted">
            Vol. 01 · Edition Live
          </p>
          <h1 className="font-display text-6xl md:text-6xl font-extrabold leading-[0.9] mt-2">
            Populavote RBBand 2026 
          </h1>
        </div>
        <Link
          href="/results"
          className="font-mono text-xs uppercase tracking-widest border border-ink px-4 py-2 hover:bg-ink hover:text-paper transition"
        >
          Live Results →
        </Link>
      </header>

      {/* Marquee strip */}
      <div className="overflow-hidden border-y border-ink/20 py-3 mb-12 rise" style={{ animationDelay: "0.1s" }}>
        <div className="flex marquee whitespace-nowrap font-display text-2xl italic">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="mr-12">
             ✦  ten baht equals one point  ✦  scan · pay · vote  ✦  10 บาท เท่ากับ 1 คะแนน ✦ แสกน · จ่าย · โหวต
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-6 mb-16 rise" style={{ animationDelay: "0.2s" }}>
        <Stat label="Candidates" value={candidates.length.toString()} />
        <Stat label="Total Points" value={totalPoints.toLocaleString()} />
      </section>

      {/* Candidate grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
        {candidates.length === 0 && (
          <p className="col-span-2 font-display italic text-2xl text-muted">
            No candidates yet. Add some at <Link href="/admin" className="underline">/admin</Link>.
          </p>
        )}
        {candidates.map((c, i) => (
          <article
            key={c.id}
            className="rise group"
            style={{ animationDelay: `${0.3 + i * 0.05}s` }}
          >
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-mono text-xs text-muted">№ {String(i + 1).padStart(2, "0")}</span>
              <span className="font-mono text-xs text-muted">{c.points} pts</span>
            </div>
            <Link href={`/vote/${c.id}`} className="block">
              <div className="aspect-[4/3] bg-ink/5 mb-4 overflow-hidden border border-ink/10">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display text-7xl text-ink/20">
                    {c.name.charAt(0)}
                  </div>
                )}
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight group-hover:italic transition">
                {c.name}
              </h2>
              {c.description && (
                <p className="text-muted mt-1 line-clamp-2">{c.description}</p>
              )}
              <div className="mt-3 inline-block font-mono text-xs uppercase tracking-widest border-b border-ink pb-0.5 group-hover:text-accent group-hover:border-accent transition">
                Vote for {c.name.split(" ")[0]} →
              </div>
            </Link>
          </article>
        ))}
      </section>

      <footer className="mt-24 pt-6 border-t border-ink/20 font-mono text-xs text-muted flex justify-between">
        <span>© Populavote · School Edition</span>
        <span>10 ฿ = 1 point</span>
      </footer>
    </main>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display text-5xl font-extrabold mt-1">{value}</p>
    </div>
  );
}



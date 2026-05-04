import Link from "next/link";
import { notFound } from "next/navigation";
import { serverClient, type Candidate } from "@/lib/supabase";
import VoteFlow from "@/components/VoteFlow";

export const dynamic = "force-dynamic";

export default async function VotePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = serverClient();
  const { data: candidate } = await sb
    .from("candidates")
    .select("*")
    .eq("id", id)
    .single();

  if (!candidate) notFound();
  const c = candidate as Candidate;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink">
        ← Back
      </Link>

      <div className="grid md:grid-cols-2 gap-12 mt-8">
        <div className="rise">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Voting for</p>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-[0.95] mt-2">
            {c.name}
          </h1>
          {c.description && (
            <p className="text-lg text-muted mt-4 leading-relaxed">{c.description}</p>
          )}
          <div className="aspect-[4/3] bg-ink/5 mt-6 overflow-hidden border border-ink/10">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display text-9xl text-ink/20">
                {c.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="rise" style={{ animationDelay: "0.15s" }}>
          <VoteFlow candidateId={c.id} candidateName={c.name} />
        </div>
      </div>
    </main>
  );
}
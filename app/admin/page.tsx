import Link from "next/link";
import { redirect } from "next/navigation";
import { serverClient, type LeaderboardRow } from "@/lib/supabase";
import AdminForm from "@/components/AdminForm";
import EditCandidate from "@/components/EditCandidate";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  noStore();
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20">
        <h1 className="font-display text-3xl font-bold">Admin disabled</h1>
        <p className="text-muted mt-2">Set ADMIN_TOKEN in env to enable this page.</p>
      </main>
    );
  }
  if (params.token !== expected) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20">
        <h1 className="font-display text-3xl font-bold">Admin</h1>
        <p className="text-muted mt-2">
          Add <code className="font-mono">?token=YOUR_ADMIN_TOKEN</code> to the URL.
        </p>
      </main>
    );
  }

  const sb = serverClient();

  // Pull voting state
  const { data: settings } = await sb
    .from("app_settings")
    .select("value")
    .eq("key", "voting_open")
    .single();
  const votingOpen = settings?.value === "true";

  // Pull candidates with their points + raised
  const { data } = await sb
    .from("leaderboard")
    .select("*")
    .order("display_order", { ascending: true });
  const candidates = (data ?? []) as LeaderboardRow[];

  const totalRaised = candidates.reduce((s, c) => s + c.baht_raised, 0);
  const totalPoints = candidates.reduce((s, c) => s + c.points, 0);

  // ─── Server actions ────────────────────────────────────

   async function toggleVoting() {
    "use server";
    const sb = serverClient();
    const { data: current } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "voting_open")
      .single();
    const newValue = current?.value === "true" ? "false" : "true";
    await sb.from("app_settings").upsert({
      key: "voting_open",
      value: newValue,
      updated_at: new Date().toISOString()
    });
    redirect(`/admin?token=${expected}`);
  }

  async function addCandidate(formData: FormData) {
    "use server";
    const sb = serverClient();
    await sb.from("candidates").insert({
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || "").trim() || null,
      image_url: String(formData.get("image_url") || "").trim() || null,
      display_order: Number(formData.get("display_order") || 0)
    });
    redirect(`/admin?token=${expected}`);
  }

  async function updateCandidate(formData: FormData) {
    "use server";
    const sb = serverClient();
    const id = String(formData.get("id"));
    await sb
      .from("candidates")
      .update({
        name: String(formData.get("name") || "").trim(),
        description: String(formData.get("description") || "").trim() || null,
        image_url: String(formData.get("image_url") || "").trim() || null,
        display_order: Number(formData.get("display_order") || 0)
      })
      .eq("id", id);
    redirect(`/admin?token=${expected}`);
  }

  async function deleteCandidate(formData: FormData) {
    "use server";
    const sb = serverClient();
    const id = String(formData.get("id"));
    await sb.from("candidates").delete().eq("id", id);
    redirect(`/admin?token=${expected}`);
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink"
      >
        ← Back
      </Link>
      <h1 className="font-display text-5xl font-extrabold mt-4 mb-8">Admin</h1>

      {/* Voting status + toggle */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Voting status
          </p>
          <span
            className={`font-mono text-xs uppercase tracking-widest ${
              votingOpen ? "text-ink" : "text-accent"
            }`}
          >
            {votingOpen ? "● Open" : "● Closed"}
          </span>
        </div>
        <form action={toggleVoting}>
          <button
            type="submit"
            className={`w-full py-4 font-mono text-sm uppercase tracking-widest border-2 transition ${
              votingOpen
                ? "border-ink hover:bg-ink hover:text-paper"
                : "border-accent bg-accent text-paper hover:bg-ink hover:border-ink"
            }`}
          >
            {votingOpen ? "🔒 Close voting" : "🔓 Open voting"}
          </button>
        </form>
      </section>

      {/* Totals */}
      <section className="grid grid-cols-2 gap-6 mb-10 border-y border-ink/20 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Total Points
          </p>
          <p className="font-display text-4xl font-extrabold mt-1">
            {totalPoints.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Total Raised
          </p>
          <p className="font-display text-4xl font-extrabold mt-1">
            {totalRaised.toLocaleString()} ฿
          </p>
        </div>
      </section>

      <AdminForm action={addCandidate} />

      <h2 className="font-display text-2xl font-bold mt-12 mb-4">
        Current candidates
      </h2>
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {candidates.map((c) => (
          <li key={c.id} className="py-4">
            <div className="flex items-baseline justify-between mb-2 font-mono text-xs text-muted">
              <span>{c.points} pts</span>
              <span>{c.baht_raised.toLocaleString()} ฿ raised</span>
            </div>
            <EditCandidate
              candidate={c}
              updateAction={updateCandidate}
              deleteAction={deleteCandidate}
            />
          </li>
        ))}
        {candidates.length === 0 && (
          <li className="py-4 text-muted italic">No candidates yet.</li>
        )}
      </ul>
    </main>
  );
}
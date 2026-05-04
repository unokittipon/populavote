"use client";

import { useState } from "react";

type Step = "pick" | "pay" | "verify" | "done" | "error";

const PRESETS = [10, 50, 100, 200, 500];

export default function VoteFlow({
  candidateId,
  candidateName
}: {
  candidateId: string;
  candidateName: string;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [amount, setAmount] = useState(50);
  const [intent, setIntent] = useState<{ id: string; reference: string; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [points, setPoints] = useState(0);

  const points_preview = Math.floor(amount / 10);

  async function startPayment() {
    setBusy(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/create-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId, amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setIntent(data);
      setStep("pay");
    } catch (e: any) {
      setErrMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadSlip(file: File) {
    if (!intent) return;
    setBusy(true);
    setErrMsg("");
    setStep("verify");
    try {
      const fd = new FormData();
      fd.append("slip", file);
      fd.append("intentId", intent.id);
      const res = await fetch("/api/verify-slip", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setPoints(data.points);
      setStep("done");
    } catch (e: any) {
      setErrMsg(e.message);
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  // ─── Step: pick amount ─────────────────────────────────
  if (step === "pick") {
    return (
      <div className="border border-ink p-8 bg-paper">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Step 1 of 3</p>
        <h2 className="font-display text-3xl font-bold mt-1">How many points?</h2>
        <p className="text-sm text-muted mt-1">10 ฿ = 1 point</p>

        <div className="grid grid-cols-5 gap-2 mt-6">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={`py-3 font-mono text-sm border transition ${
                amount === p
                  ? "bg-ink text-paper border-ink"
                  : "border-ink/20 hover:border-ink"
              }`}
            >
              {p}฿
            </button>
          ))}
        </div>

        <label className="block mt-6">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">Custom amount</span>
          <input
            type="number"
            min={10}
            step={10}
            max={100000}
            value={amount}
            onChange={(e) => setAmount(Math.max(10, Number(e.target.value) || 10))}
            className="w-full mt-1 border-b-2 border-ink bg-transparent font-display text-4xl py-1 focus:outline-none focus:border-accent"
          />
        </label>

        <div className="mt-6 flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">You'll get</span>
          <span className="font-display text-5xl font-extrabold">
            {points_preview} <span className="text-base font-mono text-muted">pts</span>
          </span>
        </div>

        <button
          onClick={startPayment}
          disabled={busy || amount < 10}
          className="w-full mt-8 bg-ink text-paper py-4 font-mono uppercase tracking-widest text-sm hover:bg-accent transition disabled:opacity-50"
        >
          {busy ? "Loading..." : "Generate QR →"}
        </button>

        {errMsg && <p className="mt-4 text-sm text-accent">{errMsg}</p>}
      </div>
    );
  }

  // ─── Step: pay (show QR) ───────────────────────────────
  if (step === "pay" && intent) {
    return (
      <div className="border border-ink p-8 bg-paper">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Step 2 of 3</p>
        <h2 className="font-display text-3xl font-bold mt-1">Scan & Pay</h2>

        <div className="bg-paper border border-ink/10 p-4 mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={intent.qr} alt="PromptPay QR" className="w-64 h-64" />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-y-3 font-mono text-sm">
          <dt className="text-muted">Amount</dt>
          <dd className="text-right font-bold">{amount} ฿</dd>
          <dt className="text-muted">Points</dt>
          <dd className="text-right font-bold">{points_preview}</dd>
          <dt className="text-muted">Voting for</dt>
          <dd className="text-right font-bold">{candidateName}</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="text-right">{intent.reference}</dd>
        </dl>

        <div className="mt-8 border-t border-ink/20 pt-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Step 3 of 3</p>
          <h3 className="font-display text-xl font-bold mt-1">Upload payment slip</h3>
          <p className="text-sm text-muted mt-1">
            After paying, save the slip from your bank app and upload it here.
          </p>
          <label className="mt-4 block">
            <span className="block w-full text-center cursor-pointer border-2 border-dashed border-ink py-6 font-mono text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition">
              📎 Choose slip image
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadSlip(e.target.files[0])}
            />
          </label>
        </div>
      </div>
    );
  }

  // ─── Step: verifying ───────────────────────────────────
  if (step === "verify") {
    return (
      <div className="border border-ink p-8 bg-paper">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Verifying...</p>
        <h2 className="font-display text-3xl font-bold mt-1 italic">Checking your slip</h2>
        <div className="mt-8 flex items-center gap-3">
          <div className="w-3 h-3 bg-ink rounded-full animate-pulse" />
          <div className="w-3 h-3 bg-ink rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
          <div className="w-3 h-3 bg-ink rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  // ─── Step: done ────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="border-2 border-accent p-8 bg-paper">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Confirmed</p>
        <h2 className="font-display text-5xl font-extrabold mt-1 italic">Thank you!</h2>
        <p className="text-muted mt-4">
          You added <span className="font-bold text-ink">{points} points</span> to{" "}
          <span className="font-bold text-ink">{candidateName}</span>.
        </p>
        <div className="mt-8 flex gap-3">
          <a
            href="/results"
            className="flex-1 text-center bg-ink text-paper py-4 font-mono uppercase tracking-widest text-sm hover:bg-accent transition"
          >
            See results
          </a>
          <a
            href="/"
            className="flex-1 text-center border border-ink py-4 font-mono uppercase tracking-widest text-sm hover:bg-ink hover:text-paper transition"
          >
            Vote again
          </a>
        </div>
      </div>
    );
  }

  // ─── Step: error ───────────────────────────────────────
  return (
    <div className="border-2 border-accent p-8 bg-paper">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Could not verify</p>
      <h2 className="font-display text-3xl font-bold mt-1">Something went wrong</h2>
      <p className="text-muted mt-4">{errMsg}</p>
      <button
        onClick={() => setStep("pay")}
        className="mt-6 w-full border border-ink py-3 font-mono uppercase tracking-widest text-sm hover:bg-ink hover:text-paper transition"
      >
        Try again
      </button>
    </div>
  );
}

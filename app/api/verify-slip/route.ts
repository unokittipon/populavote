import { NextRequest, NextResponse } from "next/server";
import { serverClient, isVotingOpen } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Max file size: 5 MB (slips are tiny)
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Rate limit: 3 slip verifications per minute per IP (protects SlipOK quota)
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`verify:${ip}`, 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many slip uploads. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
      { status: 429 }
    );
  }

  try {
    const fd = await req.formData();
    const file = fd.get("slip") as File | null;
    const intentId = String(fd.get("intentId") || "");

    if (!file || !intentId) {
      return NextResponse.json({ error: "Missing slip or intentId" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Slip image too large" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const sb = serverClient();

    // Block new awards if voting closed
    if (!(await isVotingOpen())) {
      return NextResponse.json({ error: "Voting is currently closed" }, { status: 403 });
    }

    // 1. Load + check the intent
    const { data: intent } = await sb
      .from("payment_intents")
      .select("*")
      .eq("id", intentId)
      .single();

    if (!intent) {
      return NextResponse.json({ error: "Invalid payment session" }, { status: 404 });
    }
    if (intent.status === "verified") {
      return NextResponse.json({ error: "Slip already verified for this session" }, { status: 409 });
    }
    if (intent.status !== "pending") {
      return NextResponse.json({ error: `Session ${intent.status}` }, { status: 409 });
    }

    // Expire old intents (>30 min)
    const ageMs = Date.now() - new Date(intent.created_at).getTime();
    if (ageMs > 30 * 60 * 1000) {
      await sb
        .from("payment_intents")
        .update({ status: "expired" })
        .eq("id", intentId);
      return NextResponse.json({ error: "Session expired, please start over" }, { status: 410 });
    }

    // 2. Send to SlipOK
    const slipForm = new FormData();
    slipForm.append("files", file);
    slipForm.append("log", "true");

    const branchId = process.env.SLIPOK_BRANCH_ID;
    const apiKey = process.env.SLIPOK_API_KEY;
    if (!branchId || !apiKey) {
      return NextResponse.json({ error: "Slip verification not configured" }, { status: 500 });
    }

    const slipRes = await fetch(
      `https://api.slipok.com/api/line/apikey/${branchId}`,
      {
        method: "POST",
        headers: { "x-authorization": apiKey },
        body: slipForm
      }
    );

    if (!slipRes.ok) {
      const text = await slipRes.text();
      console.error("SlipOK error:", slipRes.status, text);
      try {
        const j = JSON.parse(text);
        return NextResponse.json(
          { error: j.message || "Slip rejected" },
          { status: 400 }
        );
      } catch {
        return NextResponse.json({ error: "Slip verification failed" }, { status: 400 });
      }
    }

    const slipData = await slipRes.json();
    if (!slipData.success || !slipData.data) {
      return NextResponse.json({ error: "Invalid slip" }, { status: 400 });
    }

    const { amount, transRef, receiver } = slipData.data;

    // 3. Recipient check — must match our PromptPay account (no recovery from this)
    const expectedPpid = (process.env.PROMPTPAY_ID || "").replace(/\D/g, "");
    const slipPpid = String(receiver?.proxy?.value || "").replace(/\D/g, "");
    if (
      !slipPpid ||
      !(expectedPpid.endsWith(slipPpid) || slipPpid.endsWith(expectedPpid))
    ) {
      return NextResponse.json({ error: "Slip not paid to the correct account" }, { status: 400 });
    }

    if (!transRef) {
      return NextResponse.json({ error: "Slip missing transaction reference" }, { status: 400 });
    }

    // 4. Amount handling: if slip amount differs from intent amount, auto-recover
    //    by cancelling the original intent and creating a new one matching what was paid.
    //    This prevents wasting a real payment when user picked the wrong amount.
    let workingIntentId: string = intentId;
    let workingAmount: number = Number(intent.amount_baht);

    if (Number(amount) !== Number(intent.amount_baht)) {
      const slipAmount = Number(amount);

      // Need at least 10฿ minimum and within reasonable max
      if (!Number.isInteger(slipAmount) || slipAmount < 10 || slipAmount > 100000) {
        return NextResponse.json(
          { error: `Slip amount ${slipAmount}฿ is outside the allowed range (10–100,000฿)` },
          { status: 400 }
        );
      }

      // Cancel the original intent
      await sb
        .from("payment_intents")
        .update({ status: "rejected" })
        .eq("id", intentId);

      // Round down to nearest 10฿ for valid vote intent
      const flooredAmount = Math.floor(slipAmount / 10) * 10;

      const { data: newIntent, error: newErr } = await sb
        .from("payment_intents")
        .insert({
          candidate_id: intent.candidate_id,
          amount_baht: flooredAmount,
          reference_number: `RECOVER-${transRef.slice(0, 12)}-${Date.now()}`,
          status: "pending"
        })
        .select("id")
        .single();

      if (newErr || !newIntent) {
        console.error("Recovery intent creation failed:", newErr);
        return NextResponse.json(
          { error: "Could not recover from amount mismatch. Please try again." },
          { status: 500 }
        );
      }

      workingIntentId = newIntent.id;
      workingAmount = flooredAmount;
    }

    // 5. Atomic award (function rejects if transRef already used or status changed)
    const points = Math.floor(workingAmount / 10);
    const { error: rpcErr } = await sb.rpc("verify_and_award_votes", {
      p_intent_id: workingIntentId,
      p_trans_ref: transRef,
      p_points: points
    });

    if (rpcErr) {
      console.error("RPC error:", rpcErr);
      // Most common cause: duplicate transRef (slip reuse) → unique violation
      const msg =
        rpcErr.message?.includes("duplicate") || rpcErr.message?.includes("unique")
          ? "This slip has already been used"
          : rpcErr.message || "Could not award votes";
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    return NextResponse.json({ success: true, points });
  } catch (e: any) {
    console.error("verify-slip exception:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
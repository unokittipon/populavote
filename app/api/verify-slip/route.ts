import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Rate limit: 5 slip verifications per minute per IP (protects SlipOK quota)
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
      // SlipOK returns 400 with reason for invalid/duplicate slips
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

    // 3. CRITICAL: verify amount and recipient match this intent
    if (Number(amount) !== Number(intent.amount_baht)) {
      return NextResponse.json(
        { error: `Amount mismatch: paid ${amount}฿ but expected ${intent.amount_baht}฿` },
        { status: 400 }
      );
    }

    const expectedPpid = (process.env.PROMPTPAY_ID || "").replace(/\D/g, "");
    const slipPpid = String(receiver?.proxy?.value || "").replace(/\D/g, "");
    // Accept match on suffix (some banks store with/without leading zero or country code)
    if (
      !slipPpid ||
      !(expectedPpid.endsWith(slipPpid) || slipPpid.endsWith(expectedPpid))
    ) {
      return NextResponse.json({ error: "Slip not paid to the correct account" }, { status: 400 });
    }

    if (!transRef) {
      return NextResponse.json({ error: "Slip missing transaction reference" }, { status: 400 });
    }

    // 4. Atomic award (function rejects if transRef already used or status changed)
    const points = Math.floor(intent.amount_baht / 10);
    const { error: rpcErr } = await sb.rpc("verify_and_award_votes", {
      p_intent_id: intentId,
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
